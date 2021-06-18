Map.centerObject(roi,11)

//Final classification
var palette = [ 
  '51b419',     //(0) Woodlands          
  '999999',     //(1) Bare soil - snow          
  '80FF00',     //(2) Grasslands      
  'f19730',     //(3) Shrubs 
  '19141F',     //(4) Coniferous           
  '990000',     //(5) Ferns
  'e8f100',     //(6) Low veg
  '6B5B95',     //(7) Pastures
  'c0894b',     //(8) Agricolture
  '3498db'      //(9) Built-up
];  

//Printing parameters: 
//Parameters to allow a proper rendering of the output 

//RGB images 
//Map.centerObject(roi,10);
Map.addLayer(dataset, {min: 0,max: 0.3,bands: ['B4', 'B3', 'B2'], }, 'RGB', true);
Map.addLayer(dataset, {min: 0,max: 0.3,bands: ['B5', 'B4', 'B3'], }, 'CIR', false);
Map.addLayer(table)


// name of the legend
var names = ['Woodlands','Bare soil-rocks','Grasslands','Shrubs','Coniferous','Ferns','Low veg','Pastures','Agriculture','Built-up'];

// set position of panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});
 
// Create legend title
var legendTitle = ui.Label({
  value: 'Legend',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});
 
// Add the title to the panel
legend.add(legendTitle);
 
// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {
 
      // Create the label that is actually the colored box.
      var colorBox = ui.Label({
        style: {
          backgroundColor: '#' + color,
          // Use padding to give the box height and width.
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });
 
      // Create the label filled with the description text.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      }); 
 
      // return the panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
};
// Add color and and names
for (var i = 0; i < 10; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
// add legend to map (alternatively you can also print the legend to the console)
Map.add(legend);

//Define the value for the segmentation: 
var param = 7

//The result of the segmentation is commented because the result has been exported to speed up the execution

// Segmentation using a SNIC approach based on the dataset previosly generated
/*
var seeds = ee.Algorithms.Image.Segmentation.seedGrid(param);

//Segmentation using pan-sharpened 
//using TOA information from L8 - select in the period of interest, the median bands: (Color_LowResolution 'B4', 'B3', 'B2' --- Grayscale HighResolution 'B8') 

//Filter to delete noise and cloud
var cloudmaskL8 = function(image) {
   var qa = image.select('BQA'); 
   var pattern = ee.Number(2).pow(4).toInt();
   var mask = qa.bitwise_and(pattern).rightShift(4);
   return image.updateMask(mask.not());
}

//Select period of interest
var firstyear1 = ee.Filter.date('2018-06-01','2018-11-30');
var firstyear2 = ee.Filter.date('2019-06-01','2019-11-30');
var firstyear3 = ee.Filter.date('2020-06-01','2020-11-30');
var period_of_interest = ee.Filter.or(firstyear1, firstyear2, firstyear3); 

//Extract images
var image = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA')
    .filterBounds(roi)
    .filterMetadata('CLOUD_COVER', 'less_than', 20)
    .filter(period_of_interest)
    .map(cloudmaskL8)
 
//Select bands of interest
var inputBands = ['B2','B3','B4','B8']

//Compute median bands
var medianTOA = image.select(inputBands).median().clip(roi)
//print(medianTOA)
    

// Convert the RGB bands to the HSV color space.
var hsv = medianTOA.select(['B4', 'B3', 'B2']).rgbToHsv();
// Swap in the panchromatic band and convert back to RGB.
var sharpened = ee.Image.cat([
  hsv.select('hue'), hsv.select('saturation'), medianTOA.select('B8')
]).hsvToRgb();

// Display the pan-sharpened result.
Map.addLayer(sharpened,{min: 0, max: 0.25, gamma: [1.3, 1.3, 1.3]},'pan-sharpened',false);

//-----------------

var snic = ee.Algorithms.Image.Segmentation.SNIC({
  image: sharpened,
  compactness: 0,  
  connectivity: 4, 
  neighborhoodSize: 128, 
  seeds: seeds
})

snic = snic.reproject ({crs: snic.projection (), scale: 15});
Map.addLayer(snic.select('clusters'),"","segments", false)


var cluster_snic = snic.select("clusters")
//comment the following line #148
*/
var clusters_snic = clusters_snic.select("clusters")

var bandclass = ["GARVI_GL","GARVI_AS","GARVI_ON","BSI","NDBI","CVI_GL","CVI_AS","CVI_ON","NDVI_GL","NDVI_AS","NDVI_ON","slope","elevation","aspect"] 

var new_feature = clusters_snic.addBands(dataset.select(bandclass)).addBands(pcImage.select("pc1","pc2","pc3","pc4"))

var new_feature_mean = new_feature.reduceConnectedComponents({
  reducer: ee.Reducer.median(),
  labelBand: 'clusters'
})

//-------Add the corinne information for each clusters
var landcover_feat = clusters_snic.addBands(dataset.select("landcover"))

//mettere solo i valori interi più presenti in ogni cluster rispetto al corinne
var corinne_feature = landcover_feat.reduceConnectedComponents({
  reducer: ee.Reducer.mode(),
  labelBand: 'clusters'
})
//print(corinne_feature)
//Map.addLayer(corinne_feature.randomVisualizer(), {}, 'clusters',false)
//------------------

//Create a dataset with all bands used so far together with the band "clusters" and the corine information
var final_bands = new_feature_mean.addBands(corinne_feature) 
//print(final_bands,"Total bands")

//Define the training bands removing just the "clusters" bands
var predictionBands=final_bands.bandNames().remove("clusters")
//print(predictionBands,"Prediction bands")

//Classification using a random forest classifier with the training bands called predictionBands
var datasamp = final_bands.select(predictionBands).sampleRegions({
  collection: points_1k,
  properties: ['LULC4'],
  scale: 30,
  tileScale:4
}); 

print(datasamp)

//Define the list with all data information
var fc =[]
var k_folder = 50 //set number of experiments

for (var i = 0 ; i<k_folder; i++){
  var v = datasamp.randomColumn('rand',i)
  fc.push(v)
}
//print("List with all data information", fc)

//Use the map function to train (70%) and validate (30%) each classifier using a differente seed 
var classification = fc.map(function(t) {
  var train = t.filterMetadata('rand', 'less_than', 0.7);
  var val = t.filterMetadata('rand', 'not_less_than', 0.7);
  var RF = ee.Classifier.smileRandomForest({numberOfTrees: 100,variablesPerSplit:null, minLeafPopulation: 1, maxNodes: null})
          .train({
            features: train, 
            classProperty: 'LULC4', 
            inputProperties: predictionBands 
          })
  var classified = final_bands.select(predictionBands).classify(RF);
  //print('Scale in meters(RISULTATO):', classified.projection().nominalScale());
 
  //Visualization of the 50 LULC maps
  Map.addLayer(classified, {min: 0, max: 9, palette: palette}, 'LULC-OBJECT APPROACH', false);
  
  //visualize the LULC for the portion of the area
  Map.addLayer(classified.clip(table), {min: 0, max: 9, palette: palette}, 'LULC-OBJECT APPROACH : portion of area', true);

  
  
  //Validate the classifier
  var validation = val.classify(RF)
  var testAccuracy = validation.errorMatrix('LULC4', 'classification');
  
  //Compute OA
  var OA = testAccuracy.accuracy(); 
  var UA = testAccuracy.consumersAccuracy();
  var PA = testAccuracy.producersAccuracy();
  
  var precision = testAccuracy.producersAccuracy().transpose();
  var recall = testAccuracy.consumersAccuracy();

  var fscore = precision.multiply(recall).divide(precision.add(recall)).multiply(2);

  //Compute whole Precision
  var PA_mean = precision.reduce({
    reducer: ee.Reducer.mean(),
    axes: [1]
  }).get([0,0])

  //Compute whole Recall
  var UA_mean = recall.reduce({
    reducer: ee.Reducer.mean(),
    axes: [1]
  }).get([0,0])

  //Compute whole F1-score
  var total_fscore = PA_mean.multiply(UA_mean).divide(PA_mean.add(UA_mean)).multiply(2)
  
  var list=ee.List([OA,PA_mean,UA_mean,total_fscore])
  
  return [list,testAccuracy]
  
});
//print(classification, "List with value used to assess" )

/*----
Divide the results obtained in two list:
  - list_value = used to define measure for each test
  - list_confusion = used to compute the mean confusion matrix
*/

var list_value = []
var list_confusion = []

for (var i = 0; i<classification.length;i++){
  list_value.push(classification[i][0])
  list_confusion.push(classification[i][1])
}

//print("Value used to compute the accuracy of the method", list_value)
//print("Value used to compute the mean confusion matrix", list_confusion)

//---Compute the confusion matrix
var list_matrix = []
for (var i =0; i< list_confusion.length;i++ ){
  var mat = list_confusion[i].array()
  list_matrix.push(mat)
}
var matrix_sum = list_matrix[0]
for (var i = 1; i< list_matrix.length; i++){
  matrix_sum =  matrix_sum.add(list_matrix[i])
}
var confusion= matrix_sum.divide(list_matrix.length)
print(confusion.round(),"Confusion matrix")



//Convert the list in a feature collection in order to export as a CSV
var csv = ee.FeatureCollection(ee.List(list_value).map(function(point) {
  var oa = ee.List(point).get(0)
  var pa = ee.List(point).get(1)
  var ua = ee.List(point).get(2)
  var f  = ee.List(point).get(3)
  return ee.Feature(null, {'OA':oa ,'PA':pa,'UA':ua,'F':f }
  )
  }))
print(csv,"Exporting CSV")

Export.table.toDrive({
  collection: csv,
  description: 'OO_panch_loop',
  fileFormat: 'CSV'
});

