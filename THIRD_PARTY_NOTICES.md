# Third-Party Notices

**拾作** bundles the following open-source software in `vendor/`. Each library is shipped unmodified and retains its original copyright and license.

| Dependency | Version | License | Purpose | Homepage |
| --- | --- | --- | --- | --- |
| Mozilla Readability | 0.6.0 | Apache-2.0 | Article content extraction | https://github.com/mozilla/readability |
| Turndown | 7.2.4 | MIT | HTML → Markdown | https://github.com/mixmark-io/turndown |
| turndown-plugin-gfm | 1.0.2 | MIT | GFM tables / strikethrough / task lists | https://github.com/mixmark-io/turndown-plugin-gfm |
| marked | 18.0.5 | MIT | Markdown → HTML | https://github.com/markedjs/marked |
| DOMPurify | 3.4.10 | Apache-2.0 / MPL-2.0 | XSS sanitization for preview | https://github.com/cure53/DOMPurify |
| Monaco Editor | 0.55.1 | MIT | In-browser code editor (same engine as VS Code) | https://github.com/microsoft/monaco-editor |
| xterm.js | 6.0.0 | MIT | Browser terminal emulator | https://github.com/xtermjs/xterm.js |
| xterm.js FitAddon | 0.11.0 | MIT | Resize terminal rows and columns to its card | https://github.com/xtermjs/xterm.js |

## License Texts (excerpts)

### Mozilla Readability — Apache License 2.0

```
Copyright (c) 2010 Arc90 Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### Turndown — MIT

```
Copyright (c) 2017+ Dom Christie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND ...
```

### turndown-plugin-gfm — MIT

```
Copyright (c) 2017+ Dom Christie
(Standard MIT text — see https://github.com/mixmark-io/turndown-plugin-gfm/blob/master/LICENSE)
```

### marked — MIT

```
Copyright (c) 2018+, MarkedJS (https://github.com/markedjs/)
Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/)
(Standard MIT text)
```

### DOMPurify — Apache-2.0 OR MPL-2.0

```
Copyright 2024 Dr.-Ing. Mario Heiderich, Cure53

Licensed under the Apache License, Version 2.0 (the "License") OR
the Mozilla Public License, Version 2.0 (the "License"); you may not
use this file except in compliance with one of the Licenses.
```

### Monaco Editor — MIT

```
Copyright (c) 2016 - present Microsoft Corporation

All rights reserved.

MIT License (standard text)
```

### xterm.js and FitAddon — MIT

```
Copyright (c) 2014-2025, xterm.js authors

MIT License (standard text; full copies are bundled in vendor/xterm/)
```

## Notes

- Full unmodified source and original LICENSE files are available from each project's npm package or GitHub repository.
- This project only redistributes the minified / UMD build artifacts unchanged.
- Before using in a closed-source or commercial context, please verify license compatibility for each dependency.
