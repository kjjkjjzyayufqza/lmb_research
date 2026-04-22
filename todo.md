# TODO

## 待辦

- [ ] 修復 nutexb → png 命名：用 atlas name 而非 index（`Mask.png` 而非 `img-00000.png`）
- [ ] 修復 Open JSON 按鈕有時沒反應（file chooser modal 殘留問題）
- [ ] 測試 title_ef_0085 的 preview 渲染（JSON 已轉換完成）
- [ ] 調查 WebGL 渲染座標問題：world transform x,y 超出 canvas 範圍（title_ef_0060 渲染偏移）
- [ ] 確認 nutexb 轉換工具的位置或使用方式

## 已完成

- [x] 轉換 title_ef_0085.lm → title_ef_0085.json
- [x] 確認 title_ef_0060 紋理載入正常（7 個 atlas 全部 200 OK）
- [x] 確認 canvas 有渲染內容（88% 像素覆蓋）但位置偏移
