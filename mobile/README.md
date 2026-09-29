# FlaxFlow PortalAI Mobile

Aplicativo Expo/React Native do PortalAI, com suporte a Android, iOS e export web.

## Desenvolvimento

```bash
npm install
npm run start
```

Atalhos:

```bash
npm run android
npm run ios
npm run web
```

Por padrão, a API é `https://api.flaxia.com.br`. Para desenvolvimento local:

```bash
EXPO_PUBLIC_BACKEND_URL=http://localhost:4000 npm run start
```

## Verificação

```bash
npm run typecheck
npm run lint
npm run doctor
npm run export:web
```

## OAuth Google

O app usa o deep link `flaxflow://oauth/google`. O backend deve estar configurado
com Google OAuth e aceitar o parâmetro `mobileRedirect` no endpoint de início do
OAuth. O redirect HTTPS registrado no Google continua apontando para o callback
do backend; depois da troca do código, o backend encaminha o resultado ao app.

## Organização

- `src/app/`: rotas Expo Router e telas por domínio
- `src/auth/`: sessão JWT e armazenamento seguro
- `src/lib/api.ts`: cliente HTTP autenticado
- `src/components/`: componentes visuais compartilhados
