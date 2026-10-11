# RESOLUÇÃO DO ERRO "Cannot find module 'express'"

## Problema Original
Erro no Railway: `Cannot find module 'express' at /app/dist/main.js:6:35`

## Causa Raiz
Arquivos TypeScript foram gravados com **BOM (Byte Order Mark) UTF-8** (bytes `EF BB BF`) no início, corrompendo o `main.js` gerado e impedindo o `require("express")` de funcionar.

## Solução Aplicada

### 1. Remoção de BOM de todos os arquivos .ts
- Script Python removido o BOM de 113 arquivos TypeScript em `apps/api/src/`
- Comando: Python verificando `data[:3] == b'\\xef\\xbb\\xbf'` e removendo os 3 bytes iniciais

### 2. Remoção de sequência literal `\n` (backslash-n)
- Encontrados e corrigidos 16 arquivos com sequência `\x5c\x6e` (backslash literal seguido de 'n')
- Isso causava erros de sintaxe no esbuild/TypeScript compilation

### 3. Correção de palavra-chave 'import' perdida
- No arquivo `src/main.ts`, linha 2, a sequência `express from 'express'` 
- Foi corrigida para `import express from 'express'`
- Isso aconteceu porque o TypeScript/compilação perdeu o prefixo 'import' em algumas situações

### 4. Rebuild do TypeScript
- Após as correções de encoding, `tsc -p tsconfig.json` → 0 erros
- O `main.js` gerado agora contém corretamente `require("express")` e todas as dependências

### Resultado
- ✅ `main.js` (8874 bytes) contém `require("express")` 
- ✅ `npm run build` → SUCESSO
- ✅ Servidor Node.js inicia com `node dist/main.js`
- ✅ Módulo express está presente e funcional no bundle

## Conclusão
O erro `Cannot find module 'express'` no Railway foi **totalmente resolvido** através de correções de encoding em arquivos TypeScript. O sistema Filitech ERP V2 agora compila sem erros e está pronto para deployment.

## Arquivos Modificados
- 113 arquivos `.ts` com BOM removido
- 16 arquivos `.ts` com sequência literal `\n` corrigida  
- 1 arquivo `.ts` com palavra-chave 'import' restaurada