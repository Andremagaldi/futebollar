# FutebolLar — Erros & Soluções

> Documento de referência para problemas encontrados e como foram resolvidos.
> Atualizado ao longo do desenvolvimento.

---

## 1. Build Error — TypeScript cast em `admin/cobranca/page.tsx`

**Erro:**
```
./app/admin/cobranca/page.tsx:117:15
Type error: Conversion of type '{ nome_completo: any; telefone: any; }[]' to type
'{ nome_completo: string; telefone: string | null; }' may be a mistake...
```

**Causa:** O Supabase retorna joins como array, e o TypeScript não aceita cast direto de array para objeto.

**Solução:** Usar `as unknown as` para forçar o cast:
```ts
// ❌ Errado
(d.users as { nome_completo: string; telefone: string | null } | null)

// ✅ Correto
(d.users as unknown as { nome_completo: string; telefone: string | null } | null)
```

---

## 2. Build Error — `PageHeader` não aceita `children`

**Erro:**
```
./app/votacao/page.tsx:185:10
Type error: Type '{ children: false | Element; title: string; subtitle: string; }'
is not assignable to type 'IntrinsicAttributes & Props'.
Property 'children' does not exist on type 'IntrinsicAttributes & Props'.
```

**Causa:** O componente `PageHeader` não tem `children` na sua interface — usa `rightSlot` para conteúdo extra no lado direito.

**Solução:** Substituir `children` por `rightSlot`:
```tsx
// ❌ Errado
<PageHeader title="VOTAÇÃO MVP" subtitle="...">
  <button>...</button>
</PageHeader>

// ✅ Correto
<PageHeader
  title="VOTAÇÃO MVP"
  subtitle="..."
  rightSlot={
    condicao ? <button>...</button> : undefined
  }
/>
```

**Interface do PageHeader:**
```ts
interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
}
```

---

## 3. 404 após login — `/jogo` não encontrado

**Erro:** Após login (email ou Google), página retorna 404.

**Causa:** O arquivo `app/jogo/page.tsx` não existia. A pasta `app/jogo/` só tinha a subpasta `times/`.

**Solução:** Criar `app/jogo/page.tsx` (ARQUIVO_16 — hub central do jogador).

**Estrutura correta:**
```
app/jogo/
  page.tsx        ← hub central (ARQUIVO_16) — OBRIGATÓRIO
  times/
    page.tsx      ← visualização dos times (ARQUIVO_23)
```

---

## 4. 404 no Google OAuth callback

**Erro:** `GET /auth/callback 404 (Not Found)` ao tentar login com Google.

**Causa:** O Supabase OAuth redireciona para `/auth/callback` mas essa rota não existia.

**Tentativa 1 (falhou):** Criar `app/auth/callback/route.ts` com `@supabase/auth-helpers-nextjs` — projeto não usa esse pacote, usa `@supabase/supabase-js` simples.

**Tentativa 2 (falhou):** Route handler com `createClient` + `exchangeCodeForSession` — não funciona pois Google OAuth usa PKCE flow com fragmento `#access_token`, não `?code=`.

**Solução final:** Criar `app/auth/callback/page.tsx` como página **client-side**:
```tsx
"use client";
// O Supabase lê automaticamente o fragmento #access_token
// Aguarda sessão e redireciona para /jogo
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) router.replace("/jogo");
  else setTimeout(() => router.replace("/jogo"), 1500);
});
```

**No `app/page.tsx`**, o `redirectTo` deve apontar para o callback:
```ts
options: { redirectTo: `${window.location.origin}/auth/callback` },
```

**No Supabase Dashboard:**
- Authentication → URL Configuration → Redirect URLs
- Adicionar: `https://futebollar.vercel.app/auth/callback`
- Adicionar: `http://localhost:3000/auth/callback`

---

## 5. Pasta com nome errado — `app/jogo/time/` vs `app/jogo/times/`

**Erro:** Links para `/jogo/times` retornavam 404.

**Causa:** A pasta foi criada como `time` (singular) em vez de `times` (plural).

**Solução:**
```powershell
Rename-Item "app\jogo\time" "times"
```

---

## 6. Git não detecta mudanças após edição

**Sintoma:**
```
nothing to commit, working tree clean
```

**Causa:** O arquivo foi gerado nos outputs do Claude mas não foi copiado manualmente para o projeto.

**Solução:** Copiar o arquivo do output para o projeto, depois:
```powershell
git add caminho/do/arquivo.tsx
git commit -m "mensagem"
git push origin main
```

---

## 7. Coluna `pagamento_status` vs `payment_status`

**Problema:** Alguns arquivos antigos usavam `pagamento_status`, outros `payment_status`.

**Correto:** `payment_status` (coluna real na tabela `game_players`).

---

## 8. Nomes de colunas não-padrão (referência rápida)

| Tabela | Coluna errada (evitar) | Coluna correta |
|--------|----------------------|----------------|
| `games` | `game_date` | `data_jogo` |
| `games` | `created_at` | `criado_em` |
| `game_players` | `pagamento_status` | `payment_status` |
| `game_players` | `lista_status` | `status_lista` |
| `users` | `name` | `nome_completo` |

---

## 9. Auth redirect — usar `/` não `/login`

**Problema:** Páginas antigas redirecionavam para `/login` que não existe.

**Solução:** Sempre usar `router.push("/")` — a página de login é a raiz do app.

```ts
// ❌ Errado
router.push("/login")

// ✅ Correto
router.push("/")
```

---

## 10. Tabela `pix_comprovantes` não existe

**Problema:** `app/admin/page.tsx` consulta `pix_comprovantes` mas essa tabela não existe.

**Correto:** Os comprovantes ficam em `game_players` nos campos:
- `comprovante_url`
- `comprovante_status` (`aguardando_analise` | `aprovado` | `rejeitado`)
- `comprovante_observacao`
- `comprovante_enviado_em`

**Fix no `admin/page.tsx`:**
```ts
// ❌ Errado
const { count } = await supabase
  .from("pix_comprovantes")
  .select("*", { count: "exact", head: true })
  .eq("status", "pendente");

// ✅ Correto
const { count } = await supabase
  .from("game_players")
  .select("*", { count: "exact", head: true })
  .eq("comprovante_status", "aguardando_analise");
```

---

## 11. Supabase joins retornam array, não objeto

**Problema:** Ao fazer `.select("*, users(nome_completo)")`, o TypeScript trata `users` como array.

**Solução:** Normalizar com:
```ts
const u = Array.isArray(p.users) ? p.users[0] : p.users;
```

Ou usar cast `as unknown as TipoDesejado`.

---

## Arquivos gerados (referência)

| Arquivo output | Destino no projeto |
|---------------|-------------------|
| ARQUIVO_1 | `app/globals.css` |
| ARQUIVO_2 | `tailwind.config.js` |
| ARQUIVO_3 | `components/ui/ThemeToggle.tsx` |
| ARQUIVO_4 | `components/layout/BottomNav.tsx` |
| ARQUIVO_5 | `components/layout/PageHeader.tsx` |
| ARQUIVO_6 | `app/lista/page.tsx` |
| ARQUIVO_7 | `app/ranking/page.tsx` |
| ARQUIVO_9 | `app/perfil/page.tsx` |
| ARQUIVO_10 | `app/votacao/page.tsx` (antigo) |
| ARQUIVO_11 | `app/telao/page.tsx` |
| ARQUIVO_14 | `components/ProtectedRoute.tsx` |
| ARQUIVO_15 | `hooks/useRole.ts` |
| ARQUIVO_16 | `app/jogo/page.tsx` ⚠️ CRÍTICO |
| ARQUIVO_17 | `app/admin/page.tsx` |
| ARQUIVO_18 | `app/page.tsx` (login) |
| ARQUIVO_19 | `app/admin/gerente/page.tsx` |
| ARQUIVO_20 | `app/admin/financeiro/page.tsx` |
| ARQUIVO_21 | `app/admin/checkin/page.tsx` |
| ARQUIVO_22 | `app/admin/times/page.tsx` |
| ARQUIVO_23 | `app/jogo/times/page.tsx` |
| ARQUIVO_24 | `app/pagamento/page.tsx` |
| ARQUIVO_25 | `app/artilheiro/page.tsx` |
| ARQUIVO_26 | `app/regras/page.tsx` |
| ARQUIVO_27 | `app/admin/cobranca/page.tsx` |
| ARQUIVO_28 | `app/admin/comprovantes/page.tsx` |
| ARQUIVO_29 | `app/votacao/page.tsx` (intermediário) |
| ARQUIVO_30 | `app/votacao/page.tsx` (FINAL — usa rightSlot) |
| ARQUIVO_31 | `app/auth/callback/route.ts` (não usar) |
| ARQUIVO_32 | `app/auth/callback/page.tsx` ✅ |

## Arquivos a deletar
- `app/sorteio/page.tsx`
- `app/times/page.tsx`
- `app/times/exportar/page.tsx`
- `app/login/page.tsx`
- `app/gerente/page.tsx`
- `app/gerente/financeiro/page.tsx`
- `app/checkin/page.tsx`
- `app/mvp/page.tsx`
- `app/auth/callback/route.ts` (substituído por page.tsx)
