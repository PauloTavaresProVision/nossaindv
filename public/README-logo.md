# Ficheiros estáticos da app

## Logo

Guarda o logo oficial da Nossa Seguros aqui como **`logo-nossa.png`**:

```
public/logo-nossa.png
```

Tamanho recomendado: 600×144 px (proporção 25:6) ou superior, fundo transparente.
A app usa o ficheiro tanto no header da página como no header do PDF gerado.

Se o ficheiro não existir, a app cai automaticamente num SVG simplificado em
`src/components/Logo.tsx` (no PDF, é desenhado como texto com as cores da marca).

Se tiveres o **SVG oficial**, podes guardá-lo como `logo-nossa.svg` e mudar
`Logo.tsx` para apontar para esse ficheiro — o SVG é melhor que o PNG para
ecrãs de alta resolução.
