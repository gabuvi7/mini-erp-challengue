# Cliente web de Mini ERP

Requiere Node.js 18.12 o una versión posterior. Active la versión fijada de pnpm con Corepack:

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
pnpm dev
```

El cliente utiliza `http://localhost:5080` de forma predeterminada. Configure `VITE_API_URL` para conectarlo a otro origen de la API.

```bash
VITE_API_URL=http://localhost:5080 pnpm dev
```

Antes de la entrega, ejecute `pnpm test`, `pnpm lint` y `pnpm build`.
