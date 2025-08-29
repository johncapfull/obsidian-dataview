## Как пересобрать чтобы было доступно из obsidian?

```
npm run dev
```

Собирает `test-vault/.obsidian`, который засимлинкан в `~/notes/jcob/.obsidian/plugins/dataview-dev`.

По идее должен работать hot relaod через obsidian-hot-reload, но оно через раз работает лол.
Запускается через rollup, но постоянно сыпет проблемами следующего рода:
```
[!] (plugin rpt2) Error: Could not load rollup-plugin-worker-loader::module::6:/Users/ev.shapovalov/src/3rd/obsidian-dataview/src/data-import/web-worker/import-entry.ts (imported by src/data-import/web-worker/import-manager.ts): Cannot read properties of null (reading 'included')
```

В конце концов я с этим заебался бороться, и теперь собираю руками через build:


## Сборка через build

Чтобы собрать плагин можно руками сделать
```
npm run build
```

Соберет все в один файл build/main.js, который потом можно скопировать прямо в `~/notes/jcob/.obsidian/plugins/dataview-dev` руками

После этого перезагрузить плагины в obsidian (view -> force reload)


## Добавление culori
```
npm install culori
npm i --save-dev @types/culori
```

Доступно через `dv.culori.*`
