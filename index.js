// import leaflet and jquery
var L = require('leaflet'); // A lot of this could be rewritten as leaflet plugin
var $ = require('jquery'); // it is just used for query selection to ajax

// We use this to get one way hashes of maps
var sha256 = require('js-sha256').sha256;
// We don't really care if the same hash resolves to two datum with different
// ordered keys.

// Let's set up a function that will let us start dealing with state using
// the URL hash
var mapdoc; // hopefully this is the only variable we manage
var layers = {};
initBasedOnURL();
// We can start by initializing the map it won't look like much until the
// plugins have loaded.
$("#map").height(window.innerHeight - $("#map").offset().top);
var map = L.map('map', {
	crs: L.CRS.Simple,
	zoom: mapdoc.options.zoom,
	minZoom: -Infinity,
	maxZoom: Infinity,
	zoomControl: mapdoc.options.zoomControl,
	//maxBounds: L.latLngBounds([-5000,0], [25000, Math.pow(2,58)]),
});

var root  = L.layerGroup();
updateMap();
root.addTo(map);
Object.keys(layers).forEach(function(key) {
	layers[key].layer.addTo(root);
});

function updateMap() {
	// We shouldn't have to do this unless it's used in place of init i think
	map.setView(mapdoc.view);
	// Same?
	console.log(mapdoc.options.zoom);
	map.setZoom(mapdoc.options.zoom);
	// Layer deserialization
	//mapdoc.layers.forEach(function(layer){

	//}
}


// every run of preview reloads everything in the layer
var previewLayer = {
	layer: L.layerGroup(),
	shapes: [],
	fn: function() {},
	offset: {x: 0, y: 0}
}

updateLayers();

// Initialization, URL and storage

function initialMap() {
	var map = {
		options: {
			zoom: 1,
			minZoom: -Infinity,
			maxZoom: Infinity,
			zoomControl: true
		},
		created: new Date(),
		view: [0,0]
	}
	return map;
}



function initUrl(fragment) {
	mapdoc = initialMap();
	var h = sha256(JSON.stringify(mapdoc));
	localStorage.setItem(fragment, JSON.stringify(mapdoc));
	console.log(localStorage.getItem(fragment));
	location.href = "#" + h;
}

function initBasedOnURL() {
	var fragment = window.location.hash.replace('#','');
	if (fragment && fragment != '') {
		// Make this fail gracefully if you put in a bad hash
		var testdoc = JSON.parse(localStorage.getItem(fragment));
		console.log(localStorage);
		console.log(testdoc);
		if (testdoc && testdoc.created) {
			mapdoc = testdoc;
			layers = {}
			Object.keys(mapdoc.layers).forEach(function(key) {
				var layer = mapdoc.layers[key];
				console.log(layer);
				layers[key] = {
					fn: eval("(" + layer.fn + ")"),
					offset: layer.offset,
					shapes: layer.shapes,
					layer: L.layerGroup()
				}
			});
		} else {
			initUrl(fragment);
		}
	} else {
		// Otherwise we'll make an empty map and put the hash in the URL.
		initUrl(fragment);
	}
}

function serializeLayers() {
	var slayers = {};
	Object.keys(layers).forEach(function(key) {
		var layer = layers[key];
		slayers[key] = {
			fn: layer.fn.toString(),
			offset: layer.offset,
			shapes: []
		}
	});
	return slayers;
}

function updateStorage() {
	var h = sha256(JSON.stringify(mapdoc));
	console.log(h);
	mapdoc.options.crs = L.CRS.Simple;
	mapdoc.lastHash = h;
	mapdoc.view = map.getCenter();
	mapdoc.layers = serializeLayers();
	mapdoc.options.zoom = map.getZoom();
	localStorage.setItem(h, JSON.stringify(mapdoc));
	location.href = "#" + h;
}

// Map Events

window.onpopstate = function(evt) {
	// TODO
}

var marker = L.marker([0, 0]).addTo(map);
// We'll attach events as we go

map.on('movestart', function(evt) {
	console.log('start');
});

map.on('move', function(evt) {
	console.log('move');
});

map.on('moveend', function(evt) {
	updateLayers();
	updateStorage();
	console.log(map.getZoom());
});

function loadCodeLayer() {
	var codeLayer = {
		offsetx: parseInt($("#offsetx").val()) || 0,
		offsety: parseInt($("#offsety").val()) || 0,
		code: myCodeMirror.getValue()
	}
	previewCodeLayer(codeLayer);
}

$(document).ready(function(){

	$("#preview").click(function(evt) {
		loadCodeLayer();
	});

	$("#clearPreview").click(function(evt) {
		console.log('clear');
		previewLayer.layer.clearLayers();
	});

	$("#addLayer").click(function(evt) {
		var layerString = {
			fn: previewLayer.fn.toString(),
			offset: previewLayer.offset,
			shapes: []
		};
		console.log(layerString);
		var newLayer = {
			fn: previewLayer.fn,
			offset: layerString.offset,
			shapes: [],
			layer: previewLayer.layer
		};
		layers[sha256(JSON.stringify(layerString))] = newLayer;
		updateStorage();
		previewLayer = {
			layer: L.layerGroup(),
			shapes: [],
			fn: function() {},
			offset: {x: 0, y: 0}
		}
		updateLayers();
		updatePreviousLayers();
	});

	$("#openfile").click(function() {
		var file = document.getElementById('file').files[0];
		var fr = new FileReader();
		fr.onload = receivedText;
		fr.readAsText(file);
	});
// http://stackoverflow.com/questions/7346563/loading-local-json-file
	function receivedText(e) {
		var lines = e.target.result;
		mapdoc = JSON.parse(lines);
		root.clearLayers();
		layers = {};
		Object.keys(mapdoc.layers).forEach(function(key) {
			var layer = mapdoc.layers[key];
			console.log(layer);
			layers[key] = {
				fn: eval("(" + layer.fn + ")"),
				offset: layer.offset,
				shapes: layer.shapes,
				layer: L.layerGroup()
			}
			layers[key].layer.addTo(root);
		});
		updateMap();
		updateLayers();
		updateStorage();
		updatePreviousLayers();
	}

	$("#download").click(function() {
		var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mapdoc));
		var dlAnchorElem = document.getElementById('download');
		dlAnchorElem.setAttribute("href",     dataStr     );
		dlAnchorElem.setAttribute("download", "datlas.json");
		//dlAnchorElem.click();
	});

	// Instantiate editor
	$("#code").focus();
});

function copyCode(key) {
	var code = layers[key].fn.toString();
	// This nasty bit makes sure the client doesn't have to look
	// at boilerplate.
	// 24 long (function(window, add) {
	code = code.slice(24, code.lastIndexOf('})'));
	console.log(code);
	$("#code").focus();
	myCodeMirror.setValue(code);
	//$("#code").val(code);
}

function updatePreviousLayers() {
	console.log('layers');
	// TODO better, it doesn't manage state and can't tell what was
	Object.keys(layers).forEach(function(key) {
		var n = $("#previousLayers")
			.prepend("<p id='" + key + "'><a href='#'>" + key.slice(0, 8) + "</a></p>")

		$("#" + key).click(function() {
				console.log('copying code')
				console.log(key);
				copyCode(key);
			});
	});
}

// Plugins

// This is a nice sidebar but might take extra work to interact with
// map innards. Use it for saving at least if not bookmarks/tools
// https://github.com/Turbo87/sidebar-v2

// I have a feeling this will be a general packaging problem for these
// plugins.
var sidebarplugin = require('./node_modules/sidebar-v2/js/leaflet-sidebar.js');
var sidebar = L.control.sidebar('sidebar', {position: "right"}).addTo(map);


var CodeMirror = require('codemirror');

var boilerplate = "// Window is an object that let's you get the coordinates and zoom\n"
boilerplate += "// level of the current view. Use it to control which objects to\n"
boilerplate += "// return from your function.\n"
boilerplate += "var from = Math.floor(window.left);\n"
boilerplate += "var to = Math.floor(window.right);\n"
boilerplate += "var layer = L.layerGroup();\n"
boilerplate += "for (var k = from; k < to; k++) {\n"
boilerplate += "  // The add function is a callback that you call on each \n"
boilerplate += "  // you want to add to the map.\n"
boilerplate += "  add(L.circle([0, k], 0.8));\n"
boilerplate += "}\n"

document.getElementById('code').innerHTML = boilerplate;

var myCodeMirror = CodeMirror.fromTextArea(document.getElementById('code'), {
			mode: "javascript",
			lineNumbers: true,
    	styleActiveLine: true,
    	matchBrackets: true,
		});
myCodeMirror.setOption("theme", "eclipse");

myCodeMirror.on("changes", function(evt) {
	loadCodeLayer();
})
// None of the sidebar events are handled at this level... but we'll add them
// here for now. It's not layout-aware and will obscure underlayers.


function bounds() {
	var b = map.getBounds();
	return {
		left: b.getWest(),
		right: b.getEast(),
		top: b.getNorth(),
		bottom: b.getSouth()
	}
}

function updateLayer(layer) {
	console.log(layer.fn);
	layer.fn(
		bounds(),
		function(shape) {
			window.requestAnimationFrame(function() {
				// Check a cache of shapes before adding it.
				// I don't think we'll serialize this...
				if ('setLatLngs' in shape) {
					shape.setLatLngs(shape.getLatLngs().map(function(loc) {
						return [loc.lat + layer.offset.y, loc.lng + layer.offset.x];
					}));
				} else if ('setLatLng' in shape) {
					shape.setLatLng([shape.getLatLng().lat + layer.offset.y, shape.getLatLng().lng + layer.offset.x])
				}
				// Markers get special treatment
				var shapeJSON = shape.toGeoJSON();
				if (layer.shapes.indexOf(sha256(JSON.stringify(shapeJSON))) == -1) {
					shape.addTo(layer.layer);
					layer.shapes.push(sha256(JSON.stringify(shapeJSON)));
				}
			})
			// since we're previewing we don't update the doc here
		});
}

function previewCodeLayer(codeLayer) {
	previewLayer.layer.clearLayers();
	previewLayer.layer = L.layerGroup();
	var previewCode = "(function(window, add) {"
	previewCode += codeLayer.code
	previewCode += "})"
	console.log(previewCode);
	var shapesPromise = eval(previewCode); // :)
	previewLayer.layer.addTo(root);
	previewLayer = {fn: shapesPromise, layer: previewLayer.layer, shapes: [], offset: {x: codeLayer.offsetx, y: codeLayer.offsety}};
	// layers.push(layer);
	updateLayer(previewLayer);
}

function updateLayers() {
	console.log(layers);
	Object.keys(layers).forEach(function(key) {
		console.log('updating');
		console.log(key);
		updateLayer(layers[key]);
	})
	console.log('updating preview')
	updateLayer(previewLayer);
}

function cacheget(url, callback, options) {
	var getdoc = {
		url: url
	};
	var key = sha256(JSON.stringify(getdoc));
	if (key in localStorage) {
		callback(JSON.parse(localStorage.getItem(key)));
	} else {
		$.ajax(url, {
			data : JSON.stringify(data),
			contentType : 'application/json',
			type : 'POST',
			success: function(res) {
				localStorage.setItem(key, JSON.stringify(res));
				callback(res);
			}
		});
	}
}

function cachepost(url, data, callback) {
	var postdoc = {
		url: url,
		data: data
	};
	var key = sha256(JSON.stringify(postdoc));
	if (sha256(JSON.stringify(postdoc)) in localStorage) {
		callback(JSON.parse(localStorage.getItem(key)));
	} else {
		$.ajax(url, {
			data : JSON.stringify(data),
			contentType : 'application/json',
			type : 'POST',
			success: function(res) {
				localStorage.setItem(key, JSON.stringify(res));
				callback(res);
			}
		});
	}
}

/*
for codeLayerScript in codeLayers {
	var codeLayer = L.Layer();
	var shapesPromise = codeLayerScript.script;
	// Use some hashing to avoid drawing duplicates, need to include the layer
	// Eventually going to want to be able to have state transitions
	shapesPromise(map.view, function(shape){
		// offset the shape by the layer's offset
		var offset = codeLayerScript.offset;
		shape.left = shape.left + offset.left;
		shape.addTo(codeLayer);
	});
	// There are going to be a lot of updates and we don't want to block
	// leaflet on our behalf so we add asynchronous "auto-save" here to update
	// our document.
	autosave();
}
*/

// Add layer pane
// Needs to add a layer to the mapdoc and start firing the addshapes
// on the underlying layer

// Publish pane
// Can save a gist public and anonymously via API
// https://gist.github.com/fairchild/262248

// Load from url pane
// Get a public url that has a mapdoc and load it

// Download pane
// Download the doc and the viewer if you can! Just the doc
// would be a good demo.

// Search pane
// TODO This one is going to use another plugin and might get ugly


// Sidebar events

// Add code layer
// Save current mapdoc
// View history


// Toolbar items

// We'll keep things that are for directly editing a layer and directly
// controlling the map here.
// https://github.com/Leaflet/Leaflet.toolbar

// Drag around things made with draw
// https://github.com/w8r/Leaflet.draw.drag

// Add your own controls in a way perhaps easier than toolbar?
// https://github.com/CliffCloud/Leaflet.EasyButton

// A nice detachable circle label
// Make a toolbar button for adding it
// https://github.com/w8r/leaflet-labeled-circle

// Add a control to max zoom then go back fast! no options
// http://florpor.github.io/Leaflet.ShowAll/

// Add a fullscreen control so it looks like an APP
// https://github.com/Leaflet/Leaflet.fullscreen

// So you know we're doing something
// map.fire('dataloading') // when loading request
// map.fire('dataload') // when done
// https://github.com/ebrelsford/Leaflet.loading


// Search

// add all the layers into one hidden layer for searching
// the icon for when a hit is found is not nice
// http://labs.easyblog.it/maps/leaflet-search/


// Appearance and zoom

// Add a control that lets you select a box area
// https://github.com/consbio/Leaflet.ZoomBox

// Add a label to say the current zoom level
// https://github.com/unbam/Leaflet.ZoomLabel

// Add a control to quickly get to zoom level
// http://kartena.github.io/Leaflet.zoomslider/

// Pack together shapes that are below a threshold
//var deflateplugin = require('leaflet.deflate');

// https://github.com/oliverroick/Leaflet.Deflate
// https://github.com/Leaflet/Leaflet.markercluster
// https://github.com/ghybs/Leaflet.MarkerCluster.LayerSupport

// This is cool for when there is a lot of overlap, we'll see
// if it interacts with the above...
// https://github.com/jawj/OverlappingMarkerSpiderfier-Leaflet

// This is a nice way to move around
// http://kartena.github.io/Leaflet.Pancontrol/

// Visual click you gotta
// https://github.com/MazeMap/Leaflet.VisualClick

// Show the current center coordinate
// https://github.com/xguaita/Leaflet.MapCenterCoord

// A mini map
// https://github.com/Norkart/Leaflet-MiniMap


// Bookmarks

// Add a control that allows a history of places to be tagged
// Need to reverse the order that it shows the bookmarks, new ones at the
// bottom. Uses localstorage might need to adjust to use our own storage
// http://w8r.github.io/Leaflet.Bookmarks/


// Nice to haves

// Bind D3 svg to the map!!!
// Add another layer type that gives this as the boilerplate:
/*
var d3Overlay = L.d3SvgOverlay(function(selection, projection){

    var updateSelection = selection.selectAll('circle').data(dataset);
    updateSelection.enter()
        .append('circle')
        ...
        .attr("cx", function(d) { return projection.latLngToLayerPoint(d.latLng).x })
        .attr("cy", function(d) { return projection.latLngToLayerPoint(d.latLng).y });

});
*/
// https://github.com/teralytics/Leaflet.D3SvgOverlay

var tsnejs = require('./lib/tsne.js');
var D3SvgOverlayPlugin = require('./lib/L.D3SvgOverlay.js');
var d3Overlay = L.d3SvgOverlay(function(selection, projection) {

	var opt = {epsilon: 10, perplexity: 30};
	var T = new tsnejs.tSNE(opt); // create a tSNE instance

	var Y;

	var data;
	var scale = 20;
	console.log(projection)
	function updateEmbedding() {
	  var Y = T.getSolution();
	  svg.selectAll('.u')
	    .data(data.users)
			.attr("transform", function(d, i) {
				return "translate(" + projection.latLngToLayerPoint([0, (Y[i][0]*ss*scale + tx)]).x + "," +
	                            projection.latLngToLayerPoint([(Y[i][1]*ss*scale + ty), 0]).y + ")"; });

	    // .attr("transform", function(d, i) {
			// 	return "translate(" +
	    //                                       (width / 2 + (Y[i][0]*ss*scale + tx)) + "," +
	    //                                       (height / 2 + (Y[i][1]*ss*scale + ty)) + ")"; });
	}

	var svg;
	function drawEmbedding() {

	    // get min and max in each column of Y
	    var Y = T.Y;

	    svg = selection.append("g") // svg is global

	    var g = svg.selectAll(".b")
	      .data(data.users)
	      .enter().append("g")
	      .attr("class", "u");

	    g.append("svg:image")
	      .attr('x', 0)
	      .attr('y', 2)
	      .attr('width', 24)
	      .attr('height', 24)
	      .attr("xlink:href", function(d) { return "http://cs.stanford.edu/people/karpathy/tsnejs/scrape/imgs/" + d.substring(1); })

	    g.append("text")
	      .attr("text-anchor", "top")
	      .attr("font-size", 12)
	      .attr("fill", "#333")
	      .text(function(d) { return d; });

	}

	var tx=0, ty=0;
	var ss=1;

	function step() {
	  for(var k=0;k<1;k++) {
	    T.step(); // do a few steps
	  }
	  updateEmbedding();
	}

	$(window).on('load', function() {

	  $.getJSON( "data/out2.json", function( j ) {
	    data = j;
	    T.initDataDist(data.mat); // init embedding
	    drawEmbedding(); // draw initial embedding

	    //T.debugGrad();
	    setInterval(step, 0);
	    //step();

	  });
	});


});
d3Overlay.addTo(root);



// Marker transitions? This thing kinda sucks but I like the idea for
// when you are loading a code layer
// We can do this just using plain old CSS transitions I think
// https://github.com/react-map/leaflet.magicMarker

// Really high performance clustering-- I think
// https://github.com/SINTEF-9012/PruneCluster


// Stretch goals

// LEGENDARY LEGEND! Need to add the ability to choose areas for legend
// entries! Like draw a box to set what the legend icon will be and then
// set some text, that is cool!
// https://github.com/yohanboniface/Leaflet.TileLegend

// Kinda cool when thinking about output/sharing. bind
// paragraphs to positions, too OLD
// http://atlefren.github.io/storymap/

// I really hope you can actually paint!!! I doubt it works with zoom
// http://sintef-9012.github.io/Leaflet.MapPaint/

// I think they fixed this in 1.0 but in case popups are off screen
// https://yafred.github.io/leaflet-responsive-popup/default-marker-tip

// Tell the current pointer location
var mp = require('./lib/Leaflet.MousePosition-master/src/L.Control.MousePosition.js')

// then try to initialize them sensibly
// a lot of this will be spent writing the custom toolbar

// We can start with a single editable layer for the draw toolbar
// Adding multiple editable layers is cool and probably unecessary
L.control.mousePosition().addTo(map);

// events that the toolbar methods will fire can go here
// I think we need to make our own toolbar items for addlayer and addlayergroup
// these need to atomically update the map representation
// updating the URL hash and storing the previous states in a list


// map serialization
// we're not gonna use leaflets map API for now!

// maps contain options, bookmarks, an editable layer, and code layers
// the options are just a pass through to leaflet API

// if the hash in the URL is in the cache, load it up! if not try a gist!

// editable layers store all of the markers added to the layer

// code layers just store the code needed to regenerate them
// for some window

// bookmarks are a list of named position/windows


/*

Whenever the map changes position, we need to call the layer function for
each code layer. They might be in the middle of an asynchronous call, so
we should try to keep track of them to nicely end the out of window calls.

I don't think it will be blocking.



// Saving the map to local storage

It would be nice to have a button that would refresh code layers.

It would be nice to have a button to add images and be
able to resize/shape them.
http://leafletjs.com/reference.html#imageoverlay

It would be nice to be able to output the resulting mapJSON.

A graticule would be graitcool.
https://github.com/ablakey/Leaflet.SimpleGraticule

Does this index do anyting?
https://github.com/makinacorpus/Leaflet.LayerIndex


*/
