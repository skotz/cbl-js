# cbl-js
A library for CAPTCHA solving written in pure JavaScript using the HTML5 canvas.

View a [working example](http://skotz.github.io/cbl-js) or read the [quick start guide](starter/quickstart.md).

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