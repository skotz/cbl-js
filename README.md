# cbl-js
Just a CAPTCHA Breaking Library written in pure JavaScript using an HTML5 canvas.

Test out a [working example](http://skotz.github.io/cbl-js) if you'd like.

![Preprocessing Example](https://raw.githubusercontent.com/skotz/cbl-js/master/examples/codeproject/preprocess_steps.png)

![Preprocessing Example](https://raw.githubusercontent.com/skotz/cbl-js/master/examples/codeproject/segmentation_step.png)

```javascript
preprocess: function(img) {
    img.removeGray(20);
    img.blur(2);
    img.binarize(190);
    img.colorRegions(40, true);
}
```