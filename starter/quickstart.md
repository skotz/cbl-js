# Solving a CAPTCHA with CBL-JS

## Setup

**Please note:** Certain features (such as downloading a model or loading an image) do not work over the file:// protocol for local development. 
You need to use http:// or https:// to load the page or you'll get a lot of CORS errors in your browser console.
An easy way to get a local HTTP server up and running is to use the [http-server tool](https://www.npmjs.com/package/http-server).

Keep your developer console open as this library outputs a lot of very useful debug information there.

## Train

Create a copy of `train.html` from the `starter` folder, update the CBL initialization settings, and add links to images from your chosen CAPTCHA.
Most of your time will be spent adjusting the image manipulation methods in the `preprocess` method so that we can clean up the image enough to extract individual characters.

**Please note:** The very last step of the preprocess method needs to include a call to `colorRegions` or the segmentation will not work.

Once you are happy with the quality of the segmentation, call the `train` method to bring up a dialog that will walk you through categorizing and training.

![Training Screenshot](https://raw.githubusercontent.com/skotz/cbl-js/master/starter/img/train.png)

After training, save the model as `model.txt`.


## Solve

Create a copy of `solve.html` from the `starter` folder and make sure your `model.txt` from training is in that same folder.
Also make sure you're using the exact same settings when instantiating the CBL object as you did when training the model.

![Training Screenshot](https://raw.githubusercontent.com/skotz/cbl-js/master/starter/img/solve.png)