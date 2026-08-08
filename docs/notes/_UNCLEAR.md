# Itens não esclarecidos durante a migração WHY-anchor

Não são notas WHY (sem âncora, sem `used_by`) — são dúvidas levantadas ao
migrar um comentário para prosa, quando o comentário original parecia
referenciar algo que já não bate com o código atual. Consertar isso é
fora do escopo desta migração (só comentários, não lógica) — registrado
aqui para quem for revisar depois.

## packages/claude-mitm/addon.py — MESSAGE_SEND_URL_PATTERNS possivelmente inexistente

`addon.py`'s `WEBAPP_COMPLETION_SUFFIXES` comment says it matches
"claude-tracker's own `MESSAGE_SEND_URL_PATTERNS` (`background.ts`)".
Lendo o `background.ts` atual (pós-migração desta mesma Fase 3), essa
constante não existe mais lá — o listener `chrome.webRequest` que a
usava foi removido (ver nota `webrequest-cross-extension-blindspot`), e
`background.ts` de hoje não declara nenhum padrão de URL de
message-send. A referência cruzada parece desatualizada. Não fui atrás
de confirmar se algum outro arquivo (talvez um `MESSAGE_SEND_URL_MARKER`
em `claude-tracker`, análogo ao de `gpt-signal.content.ts`) é o alvo
real pretendido, nem toquei na lógica do Python — só preservei a
alegação original do comentário na nota `claude-message-send-url-sync`,
sem reescrevê-la para apontar a algo que não pude confirmar.

## scripts/install.sh — prefixo do tarball pode estar desatualizado

O comentário original de `install.sh` (linhas 38-43) diz que "o tarball's
own top-level entry is `ai-cloud-tracker-<branch>/`" e usa isso para
justificar `--strip-components=4`. Mas o repo foi renomeado para
`tabai-cloud/extensions` (ver commit `6a0f70e`, "rename org/repo
references from gojnimer-labs/ai-cloud-tracker to
tabai-cloud/extensions"), e o `REPO` usado para montar a URL do tarball
no próprio script já é `tabai-cloud/extensions`. O prefixo de nível
superior que o GitHub gera para um tarball de branch normalmente segue o
nome do repositório (esperado algo como `extensions-<branch>/`, não
`ai-cloud-tracker-<branch>/`), e o `tar` do script extrai literalmente
`"ai-cloud-tracker-${BRANCH}/packages/${TRACKER_PACKAGE}/extension"` —
se o prefixo real for outro, essa extração falharia (arquivo/membro não
encontrado no tarball), não silenciosamente erraria o caminho. Não testei
baixar o tarball real para confirmar (fora do escopo: só comentários, não
lógica), e não reescrevi o comentário para afirmar um prefixo que não
pude confirmar — a nota `tarball-strip-components` preserva a alegação
original do comentário como estava.
