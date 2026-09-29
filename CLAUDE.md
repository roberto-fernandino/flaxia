# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão Geral

Monorepo com dois projetos independentes:
- **FlaxFlow.PortalAI.Frontend** — Next.js 15 + React 19 + TypeScript + TailwindCSS 4
- **FlaxFlow.PortalAI.Backend** — Rust + Axum + SQLx + PostgreSQL 16

Plataforma de processamento de documentos com IA, contendo gestão de usuários, empresas, classificadores e auditoria.

---

## Frontend

**Diretório:** `FlaxFlow.PortalAI.Frontend/`

### Comandos

```bash
# Instalar dependências
npm install

# Desenvolvimento (com Turbopack)
npm run dev

# Build de produção
npm run build

# Lint
npm run lint
```

### Arquitetura

- **App Router** do Next.js (`src/app/`) — cada pasta é uma rota
- **Redux Toolkit + Redux Persist** para estado global (`src/store/slices/`)
- **Axios** para chamadas HTTP à API (`src/lib/api/`)
- Path alias `@/*` aponta para `src/*`

**Módulos principais:**
- `src/app/` — páginas por domínio: `admin/`, `documents/`, `classifiers/`, `process/`, `company/`, `dashboard/`, `settings/`
- `src/components/` — componentes reutilizáveis
- `src/types/` — definições TypeScript por domínio (`admin/`, `engine/`, `users/`)
- `src/hooks/` — React hooks customizados
- `src/emails/` — templates de e-mail (React Email)
- `src/lib/audit/` — logging de auditoria

**Variáveis de ambiente:** `.env.local` (SMTP, URLs, tokens)

---

## Backend

**Diretório:** `FlaxFlow.PortalAI.Backend/`

### Comandos

```bash
# Desenvolvimento (recarregamento automático)
cargo watch -w src -x run

# Executar diretamente
cargo run

# Build de produção
cargo build --release

# Migrations
sqlx migrate run

# Instalar sqlx-cli (pré-requisito)
cargo install sqlx-cli --no-default-features --features native-tls,postgres
```

### Infraestrutura local (Docker)

Compose file: `FlaxFlow.PortalAI.Backend/compose.yml` (run commands from that directory).

```bash
cd FlaxFlow.PortalAI.Backend

# Subir PostgreSQL + Nginx + API (produção-like; ver doc de QA para dev local)
docker compose up -d

# Apenas banco de dados (recomendado para dev: API com cargo na máquina, porta 4000)
docker compose up db -d
```

Para **portas, Next.js e variáveis sem secrets**, ver `FlaxFlow.PortalAI.Frontend/qa/LOCAL-STACK.md`.

### Arquitetura

O projeto segue uma estrutura modular por domínio dentro de `src/`:

```
src/
├── main.rs / lib.rs       # Entry point e exports
├── routes.rs              # Roteamento global + OpenAPI (Utoipa)
├── errors.rs              # Tipos de erro centralizados
├── api_response.rs        # Wrapper padrão de resposta
├── admin/                 # handlers, models, responses, routes, sql
├── users/                 # handlers, models, responses, routes, sql, api_key
├── engine/                # Processamento de documentos + AI
│   ├── classifiers/       # Regras de classificação
│   ├── ai_models.rs       # Integração com modelos de IA
│   └── cache.rs           # Cache de documentos
├── auth/                  # JWT, bcrypt
├── config/                # Configuração via variáveis de ambiente
└── migrations/            # 28 arquivos SQL
```

Cada módulo de domínio segue o padrão: `handlers.rs` → `routes.rs` → `sql.rs` (queries) + `models.rs` + `responses.rs`.

**Documentação OpenAPI:** disponível via Swagger UI em `/swagger-ui` após iniciar o servidor.

**Variáveis de ambiente:** `.env` (copiar de `.env-example`)

### Banco de dados

- PostgreSQL 16, banco `flaxflow_db`
- SQLx com verificação em tempo de compilação (queries offline em `.sqlx/`)
- Para adicionar queries, rodar `cargo sqlx prepare` após mudanças

---

## Infraestrutura de Produção

Backend e frontend são hospedados na mesma VPS via **Dokploy** (Docker Swarm + Traefik como reverse proxy/TLS automático via Let's Encrypt).

- **Dokploy** (`dokploy.flaxia.com.br`): painel de gestão de deploys, roda como serviço Swarm (`dokploy`) com Postgres próprio (`dokploy-postgres`) e Traefik (`dokploy-traefik`) — este Traefik é independente do `nginx.conf` do backend, que era usado no setup antigo pré-Dokploy.
- **Deploy**: cada app (backend e frontend) é uma Application no Dokploy, configurada para build Docker direto a partir do `Dockerfile` de cada projeto (git-based build, dispara em push). Build-time arg obrigatório no backend: `SQLX_OFFLINE=true` (sem isso o build tenta conectar a um Postgres real durante `cargo build` e falha).
- **Banco de dados**: instância Postgres gerenciada pelo Dokploy (serviço `psql` no projeto `flaxia`), separada do Postgres usado em dev local (`compose.yml`). A `DATABASE_URL` do backend em produção aponta para o hostname interno do serviço Dokploy (ex.: `flaxia-psql-<id>`), **não** para `db` (esse hostname só existe dentro da rede do `compose.yml` local/antigo).
- Domínios são gerenciados manualmente na Dokploy UI + DNS na Hostinger.

## CI/CD

- Cada projeto (`FlaxFlow.PortalAI.Backend/`, `FlaxFlow.PortalAI.Frontend/`) tem seu próprio `.github/workflows/push_pr.yml`: roda build/test em PRs e, em push para `main`, builda e publica a imagem Docker em `ghcr.io/roberto-fernandino/<flaxflow-backend|flaxflow-frontend>` (tags `latest` + versão do `Cargo.toml`/`package.json`). Requer o secret `GHCR_PAT` (personal access token com escopo `write:packages`) configurado em cada repositório.
- **O deploy em si não depende desse GHCR** — o Dokploy builda a imagem diretamente do `Dockerfile` via git push (ver seção de Infraestrutura acima). A publicação no GHCR existe para versionamento/backup das imagens e para permitir trocar o modo de deploy do Dokploy para "Docker Image" (pull do GHCR) no futuro, se necessário.
- Dockerfile multi-stage para o backend (Rust) e para o frontend (Next.js, `output: "standalone"`).
- O antigo pipeline de deploy via SSH (`release.yml`, `docker compose pull && up -d`) foi removido — substituído pelo deploy nativo do Dokploy.
