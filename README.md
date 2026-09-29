# FlaxFlow PortalAI — Monorepo

Plataforma de processamento de documentos com Inteligência Artificial. Permite extrair dados estruturados de PDFs e imagens usando modelos de IA, com fluxo de validação humana, webhooks, rastreabilidade de custo e painel administrativo.

---

## Estrutura do Repositório

```
plataforma/
├── FlaxFlow.PortalAI.Backend/   # API em Rust (Axum + SQLx + PostgreSQL)
└── FlaxFlow.PortalAI.Frontend/  # Interface em Next.js (React + Redux)
```

Cada projeto tem seu próprio README com instruções detalhadas:

- [README do Backend (Rust)](./FlaxFlow.PortalAI.Backend/README.md)
- [README do Frontend (Next.js)](./FlaxFlow.PortalAI.Frontend/README.md)

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                        Usuário / Parceiro                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (porta 3000 em dev)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend — Next.js 15 (React 19)               │
│  Páginas: /development, /operational, /admin                │
│  Estado: Redux + RTK Query                                  │
│  Tempo real: SSE (Server-Sent Events)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / REST (porta 4000 em dev)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend — Rust + Axum                          │
│  Autenticação: JWT (Bearer) ou API Key (sk_...)             │
│  Documentação: Swagger UI em /swagger-ui                    │
│  Logs: pasta logs/ com rotação diária                       │
└──────┬───────────────────┬──────────────────────────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐   ┌────────────────────────────────────────┐
│ PostgreSQL  │   │         Serviços Externos              │
│ porta 5432  │   │  • OpenRouter (IA: Claude Sonnet)      │
│ (via Docker)│   │  • Google Cloud Vision (OCR opcional)  │
│             │   │  • AWS S3 (armazenamento de arquivos)  │
└─────────────┘   └────────────────────────────────────────┘
```

---

## Como Rodar Tudo Junto (Desenvolvimento Local)

### Pré-requisitos

- [Docker](https://www.docker.com/get-started/) instalado e rodando
- [Rust](https://rustup.rs/) instalado (`rustup`)
- [Node.js 20+](https://nodejs.org/) instalado
- [cargo-watch](https://crates.io/crates/cargo-watch): `cargo install cargo-watch`
- [sqlx-cli](https://github.com/launchbaddle/sqlx-cli): `cargo install sqlx-cli --no-default-features --features native-tls,postgres`

### Passo a Passo

**1. Suba o banco de dados**
```bash
cd FlaxFlow.PortalAI.Backend
docker compose up db -d
```

**2. Configure as variáveis de ambiente do backend**
```bash
cd FlaxFlow.PortalAI.Backend
cp .env-example .env
# Edite o arquivo .env com suas chaves (veja o README do Backend)
```

**3. Rode as migrações do banco**
```bash
cd FlaxFlow.PortalAI.Backend
sqlx migrate run
```

**4. Inicie o backend (com recarregamento automático)**
```bash
cd FlaxFlow.PortalAI.Backend
cargo watch -w src -x run
```

**5. Configure e inicie o frontend (em outro terminal)**
```bash
cd FlaxFlow.PortalAI.Frontend
cp .env.local.example .env.local   # ou crie manualmente
npm install
npm run dev
```

**6. Acesse a aplicação**
- Frontend: http://localhost:3000
- API (Swagger): http://localhost:4000/swagger-ui

---

## Deploy em Produção

Backend e frontend rodam na mesma VPS via [Dokploy](https://dokploy.com/) (Docker Swarm + Traefik para reverse proxy e TLS automático):

- Cada app é uma Application no Dokploy que builda direto do `Dockerfile` do respectivo projeto a cada push (git-based build).
- O Postgres de produção é um serviço gerenciado pelo Dokploy, separado do `compose.yml` usado em dev local.
- CI (`push_pr.yml` em cada repo) builda e publica as imagens em `ghcr.io/roberto-fernandino/flaxflow-backend` e `.../flaxflow-frontend` a cada push em `main`, para versionamento — o deploy real não depende do GHCR, é feito pelo build nativo do Dokploy.
- Domínios/DNS configurados manualmente (Dokploy UI + Hostinger).

---

## Domínios da Plataforma

| Domínio | Caminho (Frontend) | Descrição |
|---|---|---|
| Desenvolvimento | `/development/*` | Criar classes de documento, classifiers, processar arquivos via API |
| Operacional | `/operational/*` | Fila de validação humana, Kanban de jobs, analytics |
| Administrativo | `/admin/*` | Gestão de usuários, uso de IA, configurações da plataforma |

---

## Conceitos Principais

- **Classe de Documento**: template que define quais campos extrair de um tipo de arquivo (ex: "Nota Fiscal", "Contrato")
- **Classifier**: roteador automático que identifica o tipo de documento enviado e aplica a classe correta
- **Processing Job**: uma execução de extração de dados de um arquivo específico
- **Validação**: revisão humana do resultado extraído pela IA, com controle de SLA
- **Webhook**: notificação automática enviada para um sistema externo quando um job é concluído/falhou
