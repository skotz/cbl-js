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

Learn by reviewing dozens of [example solutions](examples/) to common patterns found in CAPTCHAs.
- [Exact Character Splitting](examples/alawiggle/)
- [Background Noise Removal](examples/avinashsonee/)
- [Disconnected Characters](examples/bearwmceo/)
- [Convolution Filters](examples/c4shm4st3r/)
- [Image Preprocessing](examples/codeproject/)
- [Image Segmentation](examples/cryptographp/)
- [Training and Classification](examples/elvincth/)
- [Saving a Model](examples/freecap/)
- [Simple Example](examples/lakudo/)
- [Image Distortion](examples/mmoohammed/)
- [Conditional Segmentation and Fixed Character Locations](examples/paulebe/)
- [Exact Character Splitting](examples/stakkitupp/)
- [Image Blur Tricks](examples/teliz/)
- [Horizontal Line Removal](examples/yassinevic/)