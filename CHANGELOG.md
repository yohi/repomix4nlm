# Changelog

## [1.0.2](https://github.com/yohi/repomix4nlm/compare/v1.0.1...v1.0.2) (2026-06-06)


### Bug Fixes

* **bin:** npxでの起動エラーを解決するためパッケージ名のエイリアスを追加 ([dc81678](https://github.com/yohi/repomix4nlm/commit/dc81678f746810632026c94e506a4d0c4b4e049e))
* **bin:** npxでの起動エラーを解決するためパッケージ名のエイリアスを追加 ([0a06c62](https://github.com/yohi/repomix4nlm/commit/0a06c622d8c1bc566f6d5039095b9a7485cac90d))

## [1.0.1](https://github.com/yohi/repomix4nlm/compare/v1.0.0...v1.0.1) (2026-06-05)


### Bug Fixes

* explicitFiles を絶対パスに変換して正しくパッキングする ([edd66eb](https://github.com/yohi/repomix4nlm/commit/edd66ebaf6e2dcdb9aef696b9545c2eccab9c16d))
* explicitFiles を絶対パスに変換して正しくパッキングする ([414f3a6](https://github.com/yohi/repomix4nlm/commit/414f3a629267a5bb6948861902f8d694a2d54b32))

## 1.0.0 (2026-06-05)


### Features

* add buildChunks to enumerate files and compute word-based chunks ([f7d2164](https://github.com/yohi/repomix4nlm/commit/f7d216480a12666b8b9c589dcd319a504291ec90))
* add chunking algorithm (word count, bin packing, naming) ([e7127cf](https://github.com/yohi/repomix4nlm/commit/e7127cf7696872b57ff371a4117aefc50998a008))
* add CLI argument parser ([40094f2](https://github.com/yohi/repomix4nlm/commit/40094f2c0e6e29109200becdbe98ae1eecf254f4))
* add CLI entry point orchestrating clone, chunking, and output ([f2a0ee3](https://github.com/yohi/repomix4nlm/commit/f2a0ee3f42029c4a2f98b72c18d97d72537928c6))
* add constants for threshold and binary excludes ([25ca829](https://github.com/yohi/repomix4nlm/commit/25ca829909b5b998734ef7ded6a5bf21cc9d44be))
* add git clone/branch helpers with auth error detection ([4a52e91](https://github.com/yohi/repomix4nlm/commit/4a52e91c1db3bee42cdf8cc1416e91570010c5d9))
* add git URL parser and output dir name builder ([2c73037](https://github.com/yohi/repomix4nlm/commit/2c73037767a65d4e31c36e202e61c8a0bee500e3))
* add repomix runner wrapping pack() with XML .txt output ([19f3def](https://github.com/yohi/repomix4nlm/commit/19f3def446d008c0aba523d33c3f8d0dbcb6dd6d))
* GitHub PackagesへのリリースActions追加とパッケージ名の変更 ([b1d47d0](https://github.com/yohi/repomix4nlm/commit/b1d47d0dc722d6d7d5301888793c9476f3a5d72b))
* GitHub PackagesへのリリースActions追加とパッケージ名の変更 ([ab52bc5](https://github.com/yohi/repomix4nlm/commit/ab52bc51598acc2f7b9c84aab3d38760407255e3))
* implement repomix-nlm-splitter CLI tool ([c13ac77](https://github.com/yohi/repomix4nlm/commit/c13ac77ae156641c2f348ecf6607a72ed83a83a2))


### Bug Fixes

* CLI検証・gitタイムアウト・セキュリティスキャン・エラーハンドリングの改善 ([277d097](https://github.com/yohi/repomix4nlm/commit/277d097c887119d50dc6ce0153acacef9e60f436))
* package-lock.jsonの名前不一致解消とnpm publishオプションの追加 ([f0e425a](https://github.com/yohi/repomix4nlm/commit/f0e425ade80cf583941c23bd1ecf2151a6ff22b0))
