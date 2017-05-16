// processing MODIS data on GEE

// ###### MCD45A1.051  Burned Area Monthly L3 Global 500m

// read into image collection, and only select 2003-2015
var fire = ee.ImageCollection('MODIS/051/MCD45A1')
                              .filterDate('2003-01-01', '2015-12-31');

// function to create mask from QA
// maskQA2: QA = 1, only good 
var maskQA = function(image) {
  return image.updateMask(image.select("ba_qa").eq(1)
                          .and(image.select("burndate").gt(0))
                          .and(image.select("burndate").lt(366)));
};
// maskQA: QA = 1 or 2, good and fairly good
var maskQA2 = function(image) {
  return image.updateMask(image.select("ba_qa").lt(3)
                        .and(image.select("ba_qa").gt(0))
                        .and(image.select("burndate").gt(0))
                        .and(image.select("burndate").lt(366)));
};
// maskQA3: without QA filter
var maskQA3 = function(image) {
  return image.updateMask(image.select("burndate").gt(0)
                          .and(image.select("burndate").lt(366)));
};

var allfire = fire.map(maskQA3).select('burndate') // no QA filter
var goodfire = fire.map(maskQA).select('burndate') // only QA == 1

print(goodfire)

// plot to see the difference
Map.setCenter(122.5, 51.5, 8);
Map.addLayer(allfire,
            {palette: ['FF0000']}, 'No QA filter');
            
Map.addLayer(goodfire);


           
