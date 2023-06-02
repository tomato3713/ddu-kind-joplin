# ddu-kind-joplin

[Joplin](https://github.com/laurent22/joplin/) source and kind for ddu.vim.

## Required

### denops.vim

https://github.com/vim-denops/denops.vim

### ddu.vim

https://github.com/Shougo/ddu.vim

### Joplin

https://github.com/laurent22/joplin/

## Configuration

```
call ddu#custom#patch_global(#{
    \   kindOptions: #{
    \     joplin: #{
    \       defaultAction: 'open',
    \     },
    \   },
    \ })
```

## Author

tomato3713
