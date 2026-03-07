// ~Lab_1 w/ Airports.geojson~ //

// variables declared in global scope:
var map;
var stats = {};

// fx for importing GeoJSON data: 
function getData(){
    // load airport data
    fetch("data/Airports.geojson")
        .then(function(response){
            return response.json();
        })
        //call fx for: data -> stats -> symbols -> slider -> legend
        .then(function(json){ 
            var attributes = processData(json);
            calcStats(json);
            createPropSymbols(json, attributes); 
            createSequenceControls(attributes);
            createLegend(attributes);
        })
};

// fx to initiate Leaflet map:
function createMap(){
    map = L.map('map', {
        center: [38, -100],
        zoom: 4,
        zoomControl: false
    });
    // add OSM base tilelayer
    L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
    }).addTo(map);
    // move the zoom control loc
    L.control.zoom({
        position: 'topright' 
    }).addTo(map);
    // call getData function to load the GeoJSON data
    getData(map);
};

// fx to store attribute data [in array] for use in other fx:
function processData(data){
    // empty array for attributes
    var attributes = [];
    // set properties -> 1st feature in index
    var properties = data.features[0].properties;
    // push ea attribute name into array if they have "20" (yearly data only)
    for (var attribute in properties){
        if (attribute.indexOf("20") > -1){
            attributes.push(attribute);
        };
    };
    return attributes;
};

// fx to pull relevant stats for dataset:
function calcStats(data){
    // empty array for all values
    var allValues = [];
    // loop through ea airport
    for(var airport of data.features){
        // for each, loop through ea year
        for(var year = 2000; year <= 2024; year+=4){
              // get value for current year and push to array
              var value = airport.properties[String(year)];
              allValues.push(value);
        }
    }
    // get min/max value from array
    stats.min = Math.min(...allValues).toFixed(1) // rounded these to 1 dp
    stats.max = Math.max(...allValues).toFixed(1)
    // calc mean value from array
    var sum = allValues.reduce(function (a, b) {
    return a + b;
    });
    stats.mean = (sum / allValues.length).toFixed(1);
};

// fx to calc radius of ea proportional symbol:
function calcPropRadius(attValue) {
    // constant factor to adj symbol sizes evenly
    var minRadius = 3.2;
    // Flannery Appearance Compensation formula 
    var radius = 1.0083 * Math.pow(attValue/stats.min,0.5715) * minRadius
    return radius;
};

// fx to populate pop-up content (refactored):
function createPopupContent(properties, attribute){
    var popupContent = "<p><b>Scheduled Services:</b> </p> <p><b>Airport Code: </b>" + properties.Airport + "</p><p><b>" + attribute + ":</b> " + properties[attribute] + " million </p>";
    return popupContent;
}

// fx to convert to circle markers + pop-up info: 
function pointToLayer(feature, latlng, attributes){
    // attribute value to pull for symbols at ea pt
    var attribute = attributes[0];
    // marker options
    var geojsonMarkerOptions = {
        radius: 3,
        fillColor: "#0084ffd7",
        color: "#383737",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.2
    };
    // for ea feature, set attribute value - circle marker radius based on value
    var attValue = Number(feature.properties[attribute]);
    geojsonMarkerOptions.radius = calcPropRadius(attValue);
    // create circle marker layer
    var layer = L.circleMarker(latlng, geojsonMarkerOptions);
    // popup content text string
    var popupContent = createPopupContent(feature.properties, attribute);
    // bind popup to marker, offset by radius
    layer.bindPopup(popupContent, {
        offset: new L.Point(0,-geojsonMarkerOptions.radius) 
    });
    return layer;
};

// fx to add point feature circle markers to map:
function createPropSymbols(data, attributes){
    // make Leaflet GeoJSON layer + add to map
    L.geoJson(data, {
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes);
        }
    }).addTo(map);
};

// fx to resize proportional symbols by current attribute value (year):
function updatePropSymbols(attribute){
    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attribute]){
            // local variable for current feature properties
            var props = layer.feature.properties;
            // update radius per new attribute values
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);
            // update pop-up content
            var popupContent = createPopupContent(props, attribute);           
            popup = layer.getPopup();            
            popup.setContent(popupContent).update();
        };
    });
    // update temporal legend
    document.querySelector("span.year").innerHTML = attribute;  
    document.querySelector("span.year2").innerHTML = attribute;
};

// fx for slider bar:
function createSequenceControls(attributes){   
    // custom leaflet ctrl for slider
    var SequenceControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        // add html elements, event listeners directly on-add
        onAdd: function () {
            // new control container div + class name
            var container = L.DomUtil.create('div', 'sequence-control-container');
            // make a new range input element (slider-bar)
            container.insertAdjacentHTML('beforeend', '<p> <b> Scheduled Services in <span class="year2">2000</span></p> <input class="range-slider" type="range">')
            // add png icons as skip buttons to container
            container.insertAdjacentHTML('beforeend', '<button class="step" id="reverse" title="backward"><img src="img/backward.png"></button>'); // Arrow by Ghiyats Mujtaba, the Noun Project
            container.insertAdjacentHTML('beforeend', '<button class="step" id="forward" title="forward"><img src="img/forward.png"></button>'); // Arrow by Ghiyats Mujtaba, the Noun Project
            // disable event listeners when clicking within container
            L.DomEvent.disableClickPropagation(container);
            return container;
        }
    });
    // add slider container to the map
    map.addControl(new SequenceControl());
    // set slider attributes
    document.querySelector(".range-slider").max = 6;
    document.querySelector(".range-slider").min = 0;
    document.querySelector(".range-slider").value = 0;
    document.querySelector(".range-slider").step = 1;
    // internal fx to move slider <--> increment by button w/ circular looping
    var steps = document.querySelectorAll('.step');
    steps.forEach(function(step){
        // event listener for clicking buttons
        step.addEventListener("click", function(){
            var index = document.querySelector('.range-slider').value;
            if (step.id == 'forward'){  // forward button goes forward; highest -> back to 0
                index++;
                index = index > 6 ? 0 : index;
            } else if (step.id == 'reverse'){ // reverse button goes backwards; lowest <- up to 6
                index--;
                index = index < 0 ? 6 : index;
            };
            // update slider by current step
            document.querySelector('.range-slider').value = index;
            // call update symbol fx by attribute of current step index pos
            updatePropSymbols(attributes[index]);
        })
        // event listener for dragging
        document.querySelector('.range-slider').addEventListener('input', function(){
        var index = this.value;
        updatePropSymbols(attributes[index]);
  });
    })
};

// fx for legend: 
function createLegend(attributes) {
    // custom leaflet ctrl for legend
    var LegendControl = L.Control.extend({
    options: {
        position: "bottomright",
    },
    // add html elements, event listeners directly on-add
    onAdd: function () {
        // new control container div + class name
        var container = L.DomUtil.create("div", "legend-control-container");
        // make a new temporal legend 
        container.innerHTML = '<p class="temporalLegend">Scheduled Services in <span class="year">2000</span></p>';
        // start svg string for content
        var svg = '<svg id="attribute-legend">';
        // new array for looping through values from stats calc fx
        var circles = ["max", "mean", "min"];
        // loop through the array, for ea 
        for (var i = 0; i < circles.length; i++) {
        // calculate radius (r) and center (cy)
            var radius = calcPropRadius(stats[circles[i]]);
            var cy = 55 - radius;
        // update svg string 
            svg += '<circle class="legend-circle" id="' + circles[i] + '" r="' + radius + '"cy="' + cy + '" fill="#0084ffd7" opacity="0.8" stroke="#000000" cx="45"/>';  // cx to change <-> pos of circle mkrs
            // evenly space out labels            
            var textY = i * 20 + 15;            
            // add legend text to svg string            
            svg += '<text id="' + circles[i] + '-text" x="85" y="' + textY + '">' + Math.round(stats[circles[i]]*100)/100 + " million" + '</text>';
        };
        // after loop, close svg string
        svg += "</svg>";
        //add svg to legend container
        container.insertAdjacentHTML('beforeend',svg);
        return container;
    },
  });
// add the legend container to the map
  map.addControl(new LegendControl());
}

// map, map, map! 
document.addEventListener('DOMContentLoaded',createMap) // activate map fx -> calls get data -> calls sub fx to process, stats, add map elements