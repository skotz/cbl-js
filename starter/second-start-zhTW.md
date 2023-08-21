# 前提
本文是以看完 qucikstart.md 但是還不知道怎樣上手的角度出發. 強烈建議先看完原作者的範例
# 啟動 http server  
範例使用python, 在主資料夾下啟動
```python
python -m http.server
```
以下範例都以 train_miguelreb.html, solve_miguelreb.html 做說明

## 蒐集圖片
蒐集大約五張驗證碼圖片, 放置於固定資料夾`captchas/miguelreb`下

### 撰寫訓練用html Train.html
### 複製 train_miguelreb.html, 修改引用圖片來源.  
### 建立每個字元的規格   
character_set  
exact_characters  
pattern_width  
pattern_height  
blob_min_pixels  
blob_max_pixels  
### 如果字元位置固定, 加上 fixed_blob_locations
### 發揮創意, 想想怎樣讓提示字元更清楚方便辨識

## 人工辨識  
程式會問你幾個問題, 一一回答大概是甚麼字元, 不知道的字元請輸入"\\", 幫助程式建立辨識模組

![Training Screenshot](https://raw.githubusercontent.com/skotz/cbl-js/master/starter/img/train.png)

After training, save the model as `model.txt`.

## 儲存模組  
問題回答完畢後, 按下 Save Model 就能下載 cbl-model.dat, 內容是純文字檔案.

## 分析
複製 solve_miguelreb.html, 替換CBL程式內容為 train_miguelreb.html 的內容, 注意 model_file 這個設定只有solve才有用到.

![Training Screenshot](https://raw.githubusercontent.com/skotz/cbl-js/master/starter/img/solve.png)