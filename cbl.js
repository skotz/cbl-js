/*
 * CBL-js (CAPTCHA Breaking Library - JavaScript)
 * Copyright (c) Scott Clayton
 */
var cbl = (function () {

    var locked = false;
    var canvas;

    var obj = {
        
        // Load an image
        load : function (el, callback) {
            var image = document.getElementById(el);
            image.onload = function() {
                if (!locked) {
                    locked = true;
                    canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    canvas.getContext('2d').drawImage(image, 0, 0);                    
                    callback();
                }
            }            
            return this;
        },
        
        // Unload an image
        reset : function (el, callback) {
            locked = false;
            canvas = null;
            return this;
        },
        
        // Display an image in an image tag
        display : function (el) {         
            document.getElementById(el).src = canvas.toDataURL();      
            return this;
        },
        
        /***********************************************\
        | Image Segmentation Methods                    |
        \***********************************************/
        
        // Cut the image into separate blobs where each distinct color is a blob
        segmentBlob : function (minPixels, maxPixels, segmentWidth, segmentHeight, debugElement) {
            if (typeof minPixels === 'undefined') {
                minPixels = 1;
            }
            if (typeof maxPixels === 'undefined') {
                maxPixels = 100000;
            }
            if (typeof segmentWidth === 'undefined') {
                segmentWidth = 32;
            }
            if (typeof segmentHeight === 'undefined') {
                segmentHeight = 32;
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
                    blob.width = segmentWidth;
                    blob.height = segmentHeight;
                    blob.getContext('2d').putImageData(blobContext, -leftmost, -topmost, leftmost, topmost, segmentWidth, segmentHeight);
                    blob.getContext('2d').drawImage(blob, 0, 0, segmentWidth * segmentWidth / (rightmost - leftmost + 1), segmentHeight * segmentHeight / (bottommost - topmost + 1));
                                        
                    blobs.push(blob);
                        
                    if (typeof debugElement !== 'undefined') {
                        console.log("CBL: Blob size = " + pixels);
                        var test = document.createElement("img");
                        test.src = blob.toDataURL();
                        test.border = 1;
                        document.getElementById(debugElement).appendChild(test);
                    }
                }
            }
            
            return this;
        },
        
        //// Cut the image into separate blobs
        //segmentBox : function () { 
        //    var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);       
        //    var blobs = new Array();
        //    var left = 0;
        //    var right = 0;
        //    var prevVerticalBreak = true;
        //    for (var x = 0; x < image.width; x++) {
        //        var verticalBreak = true;
        //        for (var y = 0; y < image.height; y++) {
        //            var i = x * 4 + y * 4 * image.width;
        //            if (image.data[i] != 255) {
        //                verticalBreak = false;
        //                break;
        //            }
        //        }
        //        if (verticalBreak) {
        //            if (prevVerticalBreak) {
        //                left = x;
        //            } else {
        //                right = x - 1;
        //                
        //                var blob = document.createElement('canvas');
        //                blob.width = right - left;
        //                blob.height = canvas.height;
        //                blob.getContext('2d').drawImage(canvas, -left - 1, 0);    
        //                
        //                blobs.push(blob.toDataURL());
        //                
        //                console.log(blob.toDataURL())
        //                var test = document.createElement("img");
        //                test.src = blob.toDataURL();
        //                test.border = 1;
        //                document.getElementById("testDiv").appendChild(test);
        //            }
        //        }
        //        prevVerticalBreak = verticalBreak;
        //    }
        //    return this;
        //},
        
        /***********************************************\
        | Image Manipulation Methods                    |
        \***********************************************/
        
        // Fills each distinct region in the image with a different random color
        colorRegions: function (tolerance) {
            var exclusions = new Array();
            var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
            for (var x = 0; x < image.width; x++) {
                for (var y = 0; y < image.height; y++) {
                    var i = x * 4 + y * 4 * image.width;
                    // If the pixel is grayscale (not already colored)
                    if (!arrayContains(exclusions, i)) {
                        cbl.floodfill(x, y, getRandomColor(), tolerance, image, exclusions);
                    }
                }
            }
            canvas.getContext('2d').putImageData(image, 0, 0);  
            return this;
        },
        
        // Creates a color object from red, green, and blue values
        color: function (r, g, b) {
            return {r: r, g: g, b: b, a: 255};
        },
        
        // Flood fill a given color into a region starting at a certain point
        floodfill: function (x, y, fillcolor, tolerance, image, exclusions) {
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
                if (pixelCompareAndSet(i, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions)) {
                    e = i;
                    w = i;
                    mw = (i / w2) * w2; 
                    me = mw + w2;
                                        
                    while (mw < (w -= 4) && pixelCompareAndSet(w, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions));
                    while (me > (e += 4) && pixelCompareAndSet(e, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions));
                    
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
        }
    };
    
    /***********************************************\
    | Private Helper Methods                        |
    \***********************************************/
    
    var pixelCompare = function (i, targetcolor, targettotal, fillcolor, data, length, tolerance) {
        if (i < 0 || i >= length) {
            // Out of bounds
            return false; 
        }
        
        //if (data[i + 3] === 0) {
        //    // Transparent
        //    return true;  
        //}
        
        if (
            targetcolor[0] === fillcolor.r && 
            targetcolor[1] === fillcolor.g && 
            targetcolor[2] === fillcolor.b) {
            // Target is same as fill
            // targetcolor[3] === fillcolor.a // transparency
            return false;
        }
        
        if (targetcolor[0] === data[i] && 
            targetcolor[1] === data[i + 1] && 
            targetcolor[2] === data[i + 2]) {
            // Target matches surface 
            // targetcolor[3] === data[i + 3] // transparency
            return true;
        }
        
        // RGB comparison
        if (Math.abs(targetcolor[0] - data[i]) <= tolerance && 
            Math.abs(targetcolor[1] - data[i + 1]) <= tolerance && 
            Math.abs(targetcolor[2] - data[i + 2]) <= tolerance) {
            // Target matches surface within tolerance 
            // Math.abs(targetcolor[3] - data[i+3]) <= (255 - tolerance) // transparency
            return true; 
        }
        
        // No match
        return false; 
    };

    var pixelCompareAndSet = function (i, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions) {
        if (pixelCompare(i, targetcolor, targettotal, fillcolor, data, length, tolerance)) {
            if (typeof exclusions !== 'undefined') {
                if (arrayContains(exclusions, i)) {
                    return false;
                }
            }
            
            data[i] = fillcolor.r;
            data[i + 1] = fillcolor.g;
            data[i + 2] = fillcolor.b;
            data[i + 3] = fillcolor.a;
            
            if (typeof exclusions !== 'undefined') {
                exclusions.push(i);
            }
            return true;
        }
        return false;
    };
    
    var arrayContains = function (arr, obj) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === obj) {
                return true;
            }
        }
        return false;
    };
    
    var getRandomColor = function () {
        var r = Math.round(Math.random() * 200) + 55;
        var g;
        var b;
        while ((g = Math.round(Math.random() * 200) + 55) == r);
        while ((b = Math.round(Math.random() * 200) + 55) == r || b == g);
        return obj.color(r, g, b);
    };
    
    return obj;

})();