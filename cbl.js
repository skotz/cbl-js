/*
 * CBL-js
 * CAPTCHA Breaking Library in JavaScript
 * https://github.com/skotz/cbl-js
 * Copyright (c) 2015 Scott Clayton
 */
 
var CBL = function (options) {

    var defaults = {
        preprocess: function() { warn("You should define a preprocess method!"); },   
        model_file: "",
        model_string: "",
        model_loaded: function() { },
        training_complete: function() { },
        blob_min_pixels: 1,
        blob_max_pixels: 99999,
        pattern_width: 20,
        pattern_height: 20,
        pattern_maintain_ratio: false,
        pattern_auto_rotate: false,
        incorrect_segment_char: "\\",
        blob_debug: "",
        blob_console_debug: false,
        allow_console_log: false,
        allow_console_warn: true,
        perceptive_colorspace: false,
        character_set: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    };

    options = options || {};
    for (var opt in defaults) {
        if (defaults.hasOwnProperty(opt) && !options.hasOwnProperty(opt)) {
            options[opt] = defaults[opt];
        }
    }

    var obj = {
        
        /***********************************************\
        | General Methods                               |
        \***********************************************/
        
        // Load an image and attempt to solve it based on trained model
        solve : function (el) {
            return obj.train(el, true);
        },
        
        done : function (resultHandler) {
            addQueue(function () {
                resultHandler(doneResult);
                runQueue();
            });
        },
        
        // Load an image and attempt to solve it based on trained model
        train : function (el, solving) {
            if (typeof solving === 'undefined') {
                solving = false;
            }
            addQueue(function() {
                var image;
                var needSetSrc = false;
                if (document.getElementById(el) != null) {
                    image = document.getElementById(el);
                } else {
                    image = document.createElement("img");
                    needSetSrc = true;
                }
                var afterLoad = function() {
                    var solution = "";
                    var canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    canvas.getContext('2d').drawImage(image, 0, 0);  
                    
                    // Run user-specified image preprocessing
                    var cblImage = new cbl_image(canvas);
                    options.preprocess(cblImage);
                    
                    // Run segmentation
                    var blobs = cblImage.segmentBlobs(options.blob_min_pixels, 
                                                      options.blob_max_pixels, 
                                                      options.pattern_width, 
                                                      options.pattern_height, 
                                                      options.blob_debug);
                    
                    // FOR TRAINING
                    // Set up a list of patterns for a human to classify
                    if (!solving) {
                        for (var i = 0; i < blobs.length; i++) {
                            var imgUrl = blobs[i].toDataURL();
                            var blobPattern = blobToPattern(blobs[i]);
                            pendingPatterns.push({
                                imgSrc: imgUrl,
                                pattern: blobPattern,
                                imgId: patternElementID,
                                txtId: humanSolutionElementID,
                                self: obj,
                                onComplete: options.training_complete
                            });
                        }
                        
                        // Load first pattern
                        if (!currentlyTraining) {
                            obj.loadNextPattern();
                        }
                        currentlyTraining = true;
                    }
                    
                    // FOR SOLVING
                    // Solve an image buy comparing each blob against our model of learned patterns
                    else {
                        for (var i = 0; i < blobs.length; i++) {
                            solution += findBestMatch(blobToPattern(blobs[i]));
                        }
                        log("Solution = " + solution);
                    }

                    doneResult = solution;
                    runQueue();
                };
                if (image.complete && !needSetSrc) {
                    afterLoad();
                }
                else {
                    image.onload = afterLoad;
                    
                    // Set the source AFTER setting the onload
                    if (needSetSrc) {
                        image.src = el;
                    }
                }              
            });
            return this;
        },
        
        // Load the next pattern pending human classification
        loadNextPattern: function() {
            var nextPattern = pendingPatterns.pop();
            if (nextPattern) {
                log("Loading a pattern for human classification.");
                openClassifierDialog();
                document.getElementById(nextPattern.imgId).src = nextPattern.imgSrc;
                document.getElementById(nextPattern.txtId).focus();
                document.getElementById(nextPattern.txtId).onkeyup = function(event) {
                    var typedLetter = document.getElementById(nextPattern.txtId).value;
                    if ((options.character_set.indexOf(typedLetter) > -1 && typedLetter.length) || typedLetter == options.incorrect_segment_char) {
                        if (typedLetter != options.incorrect_segment_char) {                            
                            model.push({
                                pattern: nextPattern.pattern,
                                solution: document.getElementById(nextPattern.txtId).value
                            });
                            log("Added \"" + document.getElementById(nextPattern.txtId).value + "\" pattern to model!");
                        } else {
                            log("Did not add bad segment to model.");
                        }
                        document.getElementById(nextPattern.txtId).value = "";
                        
                        // Load the next pattern
                        if (pendingPatterns.length) {
                            nextPattern.self.loadNextPattern();
                        }
                        else {
                            currentlyTraining = false;
                            document.getElementById(nextPattern.txtId).onkeyup = function () { };
                            if (typeof nextPattern.onComplete === 'function') {
                                nextPattern.onComplete();
                                closeClassifierDialog();
                            }
                        }
                    }
                    else {
                        document.getElementById(nextPattern.txtId).value = "";
                    }
                };
            } 
        },
        
        // Load a model by deserializing a model string
        loadModelString: function (modelString) {
            modelString = LZString.decompressFromBase64(modelString);
            model = new Array();
            var patterns = modelString.replace(/\[/g, "").split("]");
            for (var i = 0; i < patterns.length; i++) {
                var parts = patterns[i].split("=");
                if (parts.length == 2) {
                    var p = parts[1];
                    var s = parts[0];
                    model.push({
                        pattern: p,
                        solution: s
                    });
                }
            }
            if (!model.length) {
                warn("No patterns to load in provided model.");    
            }
            else {
                log("Model loaded with " + model.length + " patterns!");
                options.model_loaded();
            }
        },
        
        // Load a model from a file on the server
        loadModel: function (url) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.send();
                xhr.onreadystatechange = function() {
                    if (xhr.readyState == 4 && xhr.status == 200 && xhr.responseText) {
                        obj.loadModelString(xhr.responseText);    
                    }
                }
            }
            catch (err) {
                warn("Could not load model from \"" + url + "\"! (" + err.message + ")");
            }
        },
        
        // Serialize the model
        serializeModel: function () {
            var str = "";
            for (var i = 0; i < model.length; i++) {
                str += "[" + model[i].solution + "=" + model[i].pattern + "]";
            }
            str = LZString.compressToBase64(str);
            return str;
        },
        
        // Save the model to a file
        saveModel: function () {
            var str = obj.serializeModel();
            var anchor = document.createElement('a');
            anchor.href = "data:application/octet-stream," + encodeURIComponent(str);
            anchor.setAttribute('download', 'cbl-model.dat');
            anchor.click();
        },
        
        // Debug stuff about the model
        debugModel: function () {
            for (var i = 0; i < model.length; i++) {
                log(model[i].solution + " pattern length = " + model[i].pattern.split(".").length);
            }
        },
        
        // Sort the model by pattern solution alphabetically
        sortModel: function() {
            model = model.sort(function(a, b) { return a.solution.localeCompare(b.solution); });
        },
        
        // Output the model as images to an element for debugging
        visualizeModel: function (elementId) {
            for (var m = 0; m < model.length; m++) {
                var pattern = document.createElement('canvas');
                pattern.width = options.pattern_width;
                pattern.height = options.pattern_height;
                var pctx = pattern.getContext('2d').getImageData(0, 0, options.pattern_width, options.pattern_height);
                
                var patternValues = model[m].pattern.split('.');
                
                for (var x = 0; x < options.pattern_width; x++) {
                    for (var y = 0; y < options.pattern_height; y++) {
                        var i = x * 4 + y * 4 * options.pattern_width;
                        var p = y + x * options.pattern_width;
                        pctx.data[i] = patternValues[p];
                        pctx.data[i + 1] = patternValues[p];
                        pctx.data[i + 2] = patternValues[p];
                        pctx.data[i + 3] = 255;
                    }
                }
                
                pattern.getContext('2d').putImageData(pctx, 0, 0); 
                
                var test = document.createElement("img");
                test.src = pattern.toDataURL();
                document.getElementById(elementId).appendChild(test);
            }
        },
        
        // Condense the model by combining patterns with the same solution
        condenseModel: function () {
            var newModel = new Array();
            var oldCount = model.length;
            for (var i = 0; i < model.length; i++) {
                var patternArray = model[i].pattern.split(".");
                var found = false;
                for (var j = 0; j < newModel.length; j++) {
                    // These two patterns have the same solution, so combine the patterns
                    if (newModel[j].solution == model[i].solution) {
                        for (var x = 0; x < newModel[j].tempArray.length; x++) {
                            newModel[j].tempArray[x] = parseInt(newModel[j].tempArray[x]) + parseInt(patternArray[x]);
                        }
                        newModel[j].tempCount++;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    newModel.push({
                        pattern: model[i].pattern,
                        solution: model[i].solution,
                        tempArray: patternArray,
                        tempCount: 1
                    });
                }
            }
            // Normalize the patterns
            for (var i = 0; i < newModel.length; i++) {
                for (var x = 0; x < newModel[i].tempArray.length; x++) {
                    newModel[i].tempArray[x] = Math.round(newModel[i].tempArray[x] / newModel[i].tempCount);
                }
                newModel[i].pattern = newModel[i].tempArray.join(".");
            }
            model = newModel;
            log("Condensed model from " + oldCount + " patterns to " + model.length + " patterns!");
            return this;
        }
    };
    
    var cbl_image = function (canvas) {
        var obj = {
            /***********************************************\
            | Image Manipulation Methods                    |
            \***********************************************/
            
            // Fills each distinct region in the image with a different random color
            colorRegions: function (tolerance, ignoreWhite) {
                if (typeof ignoreWhite === 'undefined') {
                    ignoreWhite = false;
                }
                var exclusions = new Array();
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        if (!arrayContains(exclusions, i)) {
                            obj.floodfill(x, y, getRandomColor(), tolerance, image, exclusions, ignoreWhite);
                        }
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);  
                return this;
            },
        
            // Display an image in an image tag
            display: function (el) {         
                document.getElementById(el).src = canvas.toDataURL();      
                return this;
            },
            
            // Displays the canvas as an image in another element
            debugImage: function (debugElement) {
                var test = document.createElement("img");
                test.src = canvas.toDataURL();
                document.getElementById(debugElement).appendChild(test);
                return this;
            },
            
            // Flood fill a given color into a region starting at a certain point
            floodfill: function (x, y, fillcolor, tolerance, image, exclusions, ignoreWhite) {
                var internalImage = false;
                if (typeof image === 'undefined') {
                    internalImage = true;
                    image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                }
                var data = image.data;
                var length = data.length;
                var Q = [];
                var i = (x + y * image.width) * 4;
                var e = i, w = i, me, mw, w2 = image.width * 4;
                var targetcolor = [data[i], data[i + 1], data[i + 2], data[i + 3]];
                var targettotal = data[i] + data[i + 1] + data[i + 2] + data[i + 3];

                if (!pixelCompare(i, targetcolor, targettotal, fillcolor, data, length, tolerance)) { 
                    return false; 
                }
                Q.push(i);
                while (Q.length) {
                    i = Q.pop();
                    if (typeof exclusions !== 'undefined') {
                        if (arrayContains(exclusions, i)) {
                            continue;
                        }
                    }
                    if (pixelCompareAndSet(i, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions, ignoreWhite)) {
                        e = i;
                        w = i;
                        mw = (i / w2) * w2; 
                        me = mw + w2;
                                            
                        while (mw < (w -= 4) && pixelCompareAndSet(w, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions, ignoreWhite));
                        while (me > (e += 4) && pixelCompareAndSet(e, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions, ignoreWhite));
                        
                        for (var j = w; j < e; j += 4) {
                            if (j - w2 >= 0 && pixelCompare(j - w2, targetcolor, targettotal, fillcolor, data, length, tolerance)) {
                                Q.push(j - w2);
                            }
                            if (j + w2 < length && pixelCompare(j + w2, targetcolor, targettotal, fillcolor, data, length, tolerance)) {
                                Q.push(j + w2);
                            }
                        }             
                    }
                }
                if (internalImage) {
                    canvas.getContext('2d').putImageData(image, 0, 0);  
                }
            },
            
            // Blur the image
            blur : function (iterations) {
                var amount = 1;
                var ctx = canvas.getContext('2d');
                ctx.globalAlpha = 0.3;
                
                if (typeof iterations === 'undefined') {
                    iterations = 8;
                }

                for (var i = 1; i <= iterations; i++) {
                    ctx.drawImage(canvas, amount, 0, canvas.width - amount, canvas.height, 0, 0, canvas.width - amount, canvas.height);
                    ctx.drawImage(canvas, 0, amount, canvas.width, canvas.height - amount, 0, 0, canvas.width, canvas.height - amount);
                }
            },
            
            // Convert the image to grayscale        
            grayscale : function () { 
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);        
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var brightness = 0.34 * image.data[i] + 0.5 * image.data[i + 1] + 0.16 * image.data[i + 2];
                        image.data[i] = brightness;
                        image.data[i + 1] = brightness;
                        image.data[i + 2] = brightness;
                        image.data[i + 3] = 255;
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
            
            // Change all semi-gray colors to white       
            removeGray : function (tolerance) { 
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);        
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var diff = Math.max(Math.abs(image.data[i] - image.data[i + 1]), 
                            Math.abs(image.data[i + 1] - image.data[i + 2]),
                            Math.abs(image.data[i + 2] - image.data[i]));
                        if (diff < tolerance) {
                            image.data[i] = 255;
                            image.data[i + 1] = 255;
                            image.data[i + 2] = 255;
                            image.data[i + 3] = 255;                            
                        }
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
            
            // Convert the image to black and white given a grayshale threshold        
            binarize : function (threshold) {
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var brightness = 0.34 * image.data[i] + 0.5 * image.data[i + 1] + 0.16 * image.data[i + 2];
                        image.data[i] = brightness >= threshold ? 255 : 0;
                        image.data[i + 1] = brightness >= threshold ? 255 : 0;
                        image.data[i + 2] = brightness >= threshold ? 255 : 0;
                        image.data[i + 3] = 255;
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
            
            // Apply a convolution filter
            convolute : function (matrix, factor) {
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                var out = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                var w = matrix[0].length;
                var h = matrix.length;
                var half = Math.floor(h / 2);
                if (typeof factor === 'undefined') {
                    factor = 1;
                }
                var bias = 0;
                
                for (var y = 0; y < image.height - 1; y++) {
                    for (var x = 0; x < image.width - 1; x++) {
                        var px = x * 4 + y * 4 * image.width;
                        var r = 0;
                        var g = 0;
                        var b = 0;
                    
                        for (var cy = 0; cy < w; cy++) {
                            for (var cx = 0; cx < h; cx++) {
                                var cpx = ((y + (cy - half)) * image.width + (x + (cx - half))) * 4;
                                r += image.data[(cpx + image.data.length) % image.data.length] * matrix[cy][cx];
                                g += image.data[(cpx + 1 + image.data.length) % image.data.length] * matrix[cy][cx];
                                b += image.data[(cpx + 2 + image.data.length) % image.data.length] * matrix[cy][cx];
                            }
                        }
                    
                        out.data[px + 0] = factor * r + bias;
                        out.data[px + 1] = factor * g + bias;
                        out.data[px + 2] = factor * b + bias;
                        out.data[px + 3] = 255;
                    }
                }
                
                canvas.getContext('2d').putImageData(out, 0, 0);
                return this;
            },
            
            // Apply an erosion filter
            erode : function () {
                return this.convolute([ [-1, -1, -1],
                                        [-1,  8, -1],
                                        [-1, -1, -1] ]);
            },
            
            // Apply an specific filter to each pixel
            // The filter method should accept and return one parameter that will have three properties: r, g, and b
            // foreach(function (p) { return p; })
            foreach : function (filter) {
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var pixel = { r: image.data[i + 0], g: image.data[i + 1], b: image.data[i + 2] };
                        
                        pixel = filter(pixel);
                        
                        image.data[i + 0] = pixel.r;
                        image.data[i + 1] = pixel.g;
                        image.data[i + 2] = pixel.b;
                        image.data[i + 3] = 255;
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
            
            // Invert the color of every pixel
            invert : function (filter) {
                return this.foreach(function (p) {
                    p.r = 255 - p.r;
                    p.g = 255 - p.g;
                    p.b = 255 - p.b;
                    return p;
                });
            },
            
            // Crop an image
            cropRelative : function (left, top, right, bottom) {
                var image = canvas.getContext('2d').getImageData(left, top, canvas.width - left - right, canvas.height - top - bottom);
                canvas.width = canvas.width - left - right;
                canvas.height = canvas.height - top - bottom;
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
                
            /***********************************************\
            | Image Segmentation Methods                    |
            \***********************************************/
            
            // Cut the image into separate blobs where each distinct color is a blob
            segmentBlobs : function (minPixels, maxPixels, segmentWidth, segmentHeight, debugElement) {
                if (typeof minPixels === 'undefined') {
                    minPixels = 1;
                }
                if (typeof maxPixels === 'undefined') {
                    maxPixels = 100000;
                }
                if (typeof segmentWidth === 'undefined') {
                    segmentWidth = 20;
                }
                if (typeof segmentHeight === 'undefined') {
                    segmentHeight = 20;
                }
                
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                var toColor = function (d, i) { return d[i] * 255 * 255 + d[i + 1] * 256 + d[i + 2]; };
                
                // Find distinct colors
                var colors = new Array();
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var rgb = toColor(image.data, i);
                        if (!arrayContains(colors, rgb)) {
                            colors.push(rgb);
                        }
                    }
                }
                
                // Create blobs   
                var blobs = new Array();
                for (var c = 0; c < colors.length; c++) {
                    var blob = document.createElement('canvas');
                    blob.width = image.width;
                    blob.height = image.height;
                    var blobContext = blob.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                    var blobData = blobContext.data;
                    var pixels = 0;
                    var leftmost = image.width;
                    var rightmost = 0;
                    var topmost = image.height;
                    var bottommost = 0;
                    
                    for (var x = 0; x < image.width; x++) {
                        for (var y = 0; y < image.height; y++) {
                            var i = x * 4 + y * 4 * image.width;
                            var rgb = toColor(image.data, i);
                            if (rgb == colors[c]) {
                                blobData[i] = 0;
                                blobData[i + 1] = 0;
                                blobData[i + 2] = 0;
                                blobData[i + 3] = 255;
                                
                                pixels++;
                                
                                if (x < leftmost) {
                                    leftmost = x;
                                }
                                if (x > rightmost) {
                                    rightmost = x;
                                }
                                if (y < topmost) {
                                    topmost = y;
                                }
                                if (y > bottommost) {
                                    bottommost = y;
                                }
                            } else {
                                blobData[i] = 255;
                                blobData[i + 1] = 255;
                                blobData[i + 2] = 255;
                                blobData[i + 3] = 255;
                            }
                        }
                    }
                    
                    // Only save blobs of a certain size
                    if (pixels >= minPixels && pixels <= maxPixels) {                        
                        // Scale, crop, and resize blobs
                        var temp = document.createElement('canvas');
                        temp.width = rightmost - leftmost + 1;
                        temp.height = bottommost - topmost + 1;
                        temp.getContext('2d').putImageData(blobContext, -leftmost, -topmost, leftmost, topmost, temp.width, temp.height);
                        blob.width = segmentWidth;
                        blob.height = segmentHeight;
                        if (options.pattern_maintain_ratio) {
                            var dWidth = temp.width;
                            var dHeight = temp.height;
                            if (dWidth / segmentWidth > dHeight / segmentHeight) {
                                // Scale width
                                blob.getContext('2d').drawImage(temp, 0, 0, segmentWidth, dHeight * (segmentWidth / dWidth));
                            }
                            else {
                                // Scale height
                                blob.getContext('2d').drawImage(temp, 0, 0, dWidth * (segmentHeight / dHeight), segmentHeight);
                            }
                        }
                        else {
                            // Stretch the image
                            blob.getContext('2d').drawImage(temp, 0, 0, segmentWidth, segmentHeight);
                        }

                        // Rotate the blobs using a histogram to minimize the width of non-white pixels
                        if (options.pattern_auto_rotate) {
                            blob = obj.histogramRotate(blob);
                        }
                        
                        blobs.push(blob);

                        // Debugging help
                        if (typeof debugElement !== 'undefined' && debugElement.length) {
                            if (options.blob_console_debug) {
                                log("Blob size = " + pixels);
                            }
                            var test = document.createElement("img");
                            test.src = blob.toDataURL();
                            // test.border = 1;
                            document.getElementById(debugElement).appendChild(test);
                        }
                    }
                }
                
                return blobs;
            },
            
            histogramRotate : function (blob) {
                var initial = new Image();
                initial.src = blob.toDataURL();
                
                var range = 90;
                var resolution = 5;
                var best = blob;
                var bestWidth = blob.width;
                for (var degrees = -range / 2; degrees <= range / 2; degrees += resolution) {
                    var test = document.createElement('canvas');
                    var testctx = test.getContext('2d');
                    test.width = blob.width;
                    test.height = blob.height;
                    testctx.save();
                    testctx.translate(blob.width / 2, blob.height / 2);
                    testctx.rotate(degrees * Math.PI/180);
                    testctx.drawImage(initial, -initial.width / 2, -initial.width / 2);
                    testctx.restore();
                    var testImage = testctx.getImageData(0, 0, test.width, test.height)
                    
                    // Check width of non-white pixels
                    var testWidth = 0;
                    for (var x = 0; x < testImage.width; x++) {
                        for (var y = 0; y < testImage.height; y++) {
                            var i = x * 4 + y * 4 * testImage.width;
                            if (testImage.data[i] != 255 && testImage.data[i + 3] != 0) {
                                //  Found a non-white pixel in this column
                                testWidth++;
                                break;
                            }
                            
                            // testImage.data[i] = testImage.data[i + 3] = 255;
                            // testImage.data[i + 1] = testImage.data[i + 2] = 0;
                        }
                    }
                    
                    testctx.putImageData(testImage, 0, 0);
                    
                    // Minimize the number of non-white columns
                    if (testWidth < bestWidth) {
                        bestWidth = testWidth;
                        best = test;
                    }
                    
                    // var test2 = document.createElement("img");
                    // test2.src = test.toDataURL();
                    // document.getElementById("debugPreprocessed").appendChild(test2);                        
                }
                return best;
            }
        };
        return obj;
    };
    
    /***********************************************\
    | Private Variables and Helper Methods          |
    \***********************************************/
    
    var model = new Array();
    var pendingPatterns = new Array();
    var currentlyTraining = false;
    
    var processQueue = new Array();
    var processBusy = false;
    var doneResult = "";
    
    // Add a method to the process queue and run the first item if nothing's already running
    var addQueue = function (action) {
        processQueue.push(action);
        if (!processBusy) {
            runQueue();            
        }
    };
    
    // Run the next process in the queue if one is not already running
    var runQueue = function () {
        if (processQueue.length) {
            processBusy = true;
            processQueue.shift()();
        } else {
            processBusy = false;
        }
    };
    
    // Find the best match for a pattern in the current model
    var findBestMatch = function (pattern) {
        var best = 4000000000;
        var solution = "?";
        for (var i = 0; i < model.length; i++) {
            var test = getPatternDifference(model[i].pattern, pattern);
            if (test < best) {
                best = test;
                solution = model[i].solution;
            }
        }
        return solution;
    };
    
    // Convert a blob to a pattern object
    var blobToPattern = function (blob) {
        var pattern = new Array();
        var image = blob.getContext('2d').getImageData(0, 0, blob.width, blob.height);
        for (var x = 0; x < image.width; x++) {
            for (var y = 0; y < image.height; y++) {
                var i = x * 4 + y * 4 * image.width;
                var brightness = Math.round(0.34 * image.data[i] + 0.5 * image.data[i + 1] + 0.16 * image.data[i + 2]);
                if (image.data[i + 3] < 255) {
                    brightness = 255;
                }
                pattern.push(brightness);
            }
        }
        return pattern.join('.');
    };
    
    // Get a value indicating how different two patterns are using the root mean square distance formula
    var getPatternDifference = function (p1, p2) {
        var pattern1 = p1.split('.');
        var pattern2 = p2.split('.');
        var diff = 0;
        for (var i = 0; i < pattern1.length; i++) {
            diff += (pattern1[i] - pattern2[i]) * (pattern1[i] - pattern2[i]);
        }
        return Math.sqrt(diff / pattern1.length);
    };
    
    // Compare two pixels
    var pixelCompare = function (i, targetcolor, targettotal, fillcolor, data, length, tolerance) {
        // Out of bounds?
        if (i < 0 || i >= length) {
            return false; 
        }
        
        var cNew = dataToColor(targetcolor, 0);
        var cOld = dataToColor(data, i);
        var cFill = fillcolor;
        
        // Already filled?
        if (colorCompareMaxRGB(cNew, cFill) == 0) {
            return false;
        }
        else if (colorCompareMaxRGB(cNew, cOld) == 0) {
            return true;
        }
        
        // Compare colors
        if (options.perceptive_colorspace) {
            // LAB comparison
            if (colorComparePerceptive(cNew, cOld) <= tolerance) {
                return true; 
            }          
        }
        else {
            // RGB comparison
            if (colorCompareMaxRGB(cNew, cOld) <= tolerance) {
                return true; 
            }            
        }
        
        // No match
        return false; 
    };

    // Compare two pixels and set the value if within set rules
    var pixelCompareAndSet = function (i, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions, ignoreWhite) {
        if (pixelCompare(i, targetcolor, targettotal, fillcolor, data, length, tolerance)) {
            if (typeof exclusions !== 'undefined') {
                if (arrayContains(exclusions, i)) {
                    return false;
                }
            }
            
            if (!(ignoreWhite && data[i] == 255 && data[i + 1] == 255 && data[i + 2] == 255)) {
                data[i] = fillcolor.r;
                data[i + 1] = fillcolor.g;
                data[i + 2] = fillcolor.b;
                data[i + 3] = fillcolor.a;
            }
            
            if (typeof exclusions !== 'undefined') {
                exclusions.push(i);
            }
            return true;
        }
        return false;
    };
    
    var dataToColor = function (data, i) {
        return { 
            r: data[i], 
            g: data[i + 1], 
            b: data[i + 2] 
        };
    };
    
    // Measure the difference between two colors in the RGB colorspace
    var colorCompareMaxRGB = function (color1, color2) {
        return Math.max(Math.abs(color1.r - color2.r), Math.abs(color1.g - color2.g), Math.abs(color1.g - color2.g));
    };
    
    // Measure the difference between two colors in the RGB colorspace using Root Mean Square
    var colorCompareMaxRGB = function (color1, color2) {
        return Math.sqrt((Math.pow(color1.r - color2.r, 2), Math.pow(color1.g - color2.g, 2), Math.pow(color1.g - color2.g, 2))/3);
    };
    
    // Measure the difference between two colors as measured by the human eye.
    // The "just noticeable difference" (JND) is about 2.3.
    var colorComparePerceptive = function (color1, color2) {
        // Measure the difference between two colors in the LAB colorspace (a perceptive colorspace)
        var eDelta = function (color1, color2) {
            var a = toLAB(toXYZ(color1));
            var b = toLAB(toXYZ(color2));
            return Math.sqrt(Math.pow(a.l - b.l, 2) + Math.pow(a.a - b.a, 2) + Math.pow(a.b - b.b, 2));
        };
               
        // Convert a color in the RGB colorspace to the XYZ colorspace
        var toXYZ = function (c) {
            var xR = c.r / 255.0;
            var xG = c.g / 255.0;
            var xB = c.b / 255.0;

            xR = xR > 0.04045 ? Math.pow((xR + 0.055) / 1.055, 2.4) : (xR / 12.92);
            xG = xG > 0.04045 ? Math.pow((xG + 0.055) / 1.055, 2.4) : (xG / 12.92);
            xB = xB > 0.04045 ? Math.pow((xB + 0.055) / 1.055, 2.4) : (xB / 12.92);
            
            xR = xR * 100;
            xG = xG * 100;
            xB = xB * 100;

            return {
                x: xR * 0.4124 + xG * 0.3576 + xB * 0.1805,
                y: xR * 0.2126 + xG * 0.7152 + xB * 0.0722,
                z: xR * 0.0193 + xG * 0.1192 + xB * 0.9505
            };
        };

        // Convert a color in the XYZ colorspace to the LAB colorspace
        var toLAB = function (c) {
            var xX = c.x / 95.047;
            var xY = c.y / 100.000;
            var xZ = c.z / 108.883;

            xX = xX > 0.008856 ? Math.pow(xX, 1.0 / 3) : (7.787 * xX) + (16.0 / 116);
            xY = xY > 0.008856 ? Math.pow(xY, 1.0 / 3) : (7.787 * xY) + (16.0 / 116);
            xZ = xZ > 0.008856 ? Math.pow(xZ, 1.0 / 3) : (7.787 * xZ) + (16.0 / 116);
            
            return {
                l: (116 * xY) - 16,
                a: 500 * (xX - xY),
                b: 200 * (xY - xZ)               
            };
        };
        
        // Perform the comparison
        return eDelta(color1, color2);
    };
    
    var arrayContains = function (arr, obj) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === obj) {
                return true;
            }
        }
        return false;
    };
    
    var toColor = function (r, g, b) {
        return {r: r, g: g, b: b, a: 255};
    };
    
    var getRandomColor = function () {
        var r = Math.round(Math.random() * 200) + 55;
        var g;
        var b;
        while ((g = Math.round(Math.random() * 200) + 55) == r);
        while ((b = Math.round(Math.random() * 200) + 55) == r || b == g);
        return toColor(r, g, b);
    };

    var patternElementID = "cbl-pattern";
    var humanSolutionElementID = "cbl-solution";
    
    var closeClassifierDialog = function () {  
        document.getElementById("cbl-trainer").style.display = "none";
    };
    
    var openClassifierDialog = function () {     
        if (document.getElementById("cbl-trainer") != null) {
            document.getElementById("cbl-trainer").style.display = "flex";
        }
        else {    
            var appendHtml = function (el, str) {
                var div = document.createElement('div');
                div.innerHTML = str;
                while (div.children.length > 0) {
                    el.appendChild(div.children[0]);
                }
            };
            
            appendHtml(document.body,
                '<div id="cbl-trainer">' +
                '    <div id="cbl-trainer-dialog">' +
                '        <span id="cbl-close" onclick="">&cross;</span>' +
                '        <h1>CBL-js Pattern Classifier</h1>' +
                '        <p>Identify the character in the image below by typing it into the textbox.</p>' +
                '        <p>Type <span class="cbl-discard">' + options.incorrect_segment_char + '</span> to discard a pattern if the image was not segmented properly.</p>' +
                '        <div class="cbl-row">' +
                '            <div class="cbl-cell-50 cbl-right">' +
                '                <img id="' + patternElementID + '" />' +
                '            </div>' +
                '            <div class="cbl-cell-50">' +
                '                <input id="' + humanSolutionElementID + '" type="text" />' +
                '            </div>' +
                '        </div>' +
                '    </div>' +
                '    <small><a href="https://github.com/skotz/cbl-js" target="_blank">CBL-js &copy; Scott Clayton</a></small>' +
                '</div>');
                
            document.getElementById("cbl-close").addEventListener("click", function(e) {
                closeClassifierDialog();
                e.preventDefault();
            });
        }
    };
    
    var log = function (message) {
        if (options.allow_console_log) {
            console.log("CBL: " + message);
        }  
    };
    
    var warn = function (message) {
        if (options.allow_console_warn) {
            console.warn("CBL: " + message);
        }
    };
        
    // ZIP compression from https://github.com/pieroxy/lz-string
    var LZString=function(){function o(o,r){if(!t[o]){t[o]={};for(var n=0;n<o.length;n++)t[o][o.charAt(n)]=n}return t[o][r]}var r=String.fromCharCode,n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",t={},i={compressToBase64:function(o){if(null==o)return"";var r=i._compress(o,6,function(o){return n.charAt(o)});switch(r.length%4){default:case 0:return r;case 1:return r+"===";case 2:return r+"==";case 3:return r+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(e){return o(n,r.charAt(e))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(o){return null==o?"":""==o?null:i._decompress(o.length,16384,function(r){return o.charCodeAt(r)-32})},compressToUint8Array:function(o){for(var r=i.compress(o),n=new Uint8Array(2*r.length),e=0,t=r.length;t>e;e++){var s=r.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null===o||void 0===o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;t>e;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(o){return null==o?"":i._compress(o,6,function(o){return e.charAt(o)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(n){return o(e,r.charAt(n))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(o,r,n){if(null==o)return"";var e,t,i,s={},p={},u="",c="",a="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<o.length;i+=1)if(u=o.charAt(i),Object.prototype.hasOwnProperty.call(s,u)||(s[u]=f++,p[u]=!0),c=a+u,Object.prototype.hasOwnProperty.call(s,c))a=c;else{if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++),s[c]=f++,a=String(u)}if(""!==a){if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==r-1){d.push(n(m));break}v++}return d.join("")},decompress:function(o){return null==o?"":""==o?null:i._decompress(o.length,32768,function(r){return o.charCodeAt(r)})},_decompress:function(o,n,e){var t,i,s,p,u,c,a,l,f=[],h=4,d=4,m=3,v="",w=[],A={val:e(0),position:n,index:1};for(i=0;3>i;i+=1)f[i]=i;for(p=0,c=Math.pow(2,2),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(t=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 2:return""}for(f[3]=l,s=l,w.push(l);;){if(A.index>o)return"";for(p=0,c=Math.pow(2,m),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(l=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 2:return w.join("")}if(0==h&&(h=Math.pow(2,m),m++),f[l])v=f[l];else{if(l!==d)return null;v=s+s.charAt(0)}w.push(v),f[d++]=s+v.charAt(0),h--,s=v,0==h&&(h=Math.pow(2,m),m++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module&&(module.exports=LZString);
    
    // Load the model
    if (options.model_file.length) {
        obj.loadModel(options.model_file);
    } else if (options.model_string.length) {
        obj.loadModelString(options.model_string);
    }
    
    return obj;

};