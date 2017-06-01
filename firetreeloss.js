///////////////////////////////////////////////////////////////
/// This script calculate the fire-/other induced forest loss
/// using MODIS burned area and Hansen's forest loss data
/// calculated as 30 meter resolutions

////////////////////////////////////////////////////////////////
/// read into hansen's forest cover loss data
var gfc2014 = ee.Image('UMD/hansen/global_forest_change_2015');
// print(gfc2014);
var mask = gfc2014.select(['datamask']);

var mask = mask.gte(1);
print('The land mask scale/resolution is', mask.projection().nominalScale());

// land = 1, ocean = 0
Map.addLayer(mask,
            {min: 0, max: 2, palette: ['black', 'green', 'blue']}, 'landsat mask');
       
////////////////////////////////////////////////////////////////
/// read into MODIS burned area data MCD45A1 v051, 500m/Monthly resolution
var rectangle = ee.Geometry.Rectangle([120, 125, 47.5, 52.5]);

// only select data from 2003-2015
var fire = ee.ImageCollection('MODIS/051/MCD45A1')
                              .filterDate('2003-01-01', '2015-12-31');
//                              .filterBounds(ee.Geometry.Rectangle([120, 125, 47.5, 52.5]));

// function to create mask from QA, only select the best data
var maskQA = function(image) {
  return image.updateMask(image.select("ba_qa").eq(1)
                          .and(image.select("burndate").gt(0))
                          .and(image.select("burndate").lt(366)));
};

var maskQA3 = function(image) {
  return image.updateMask(image.select("burndate").gt(0)
                          .and(image.select("burndate").lt(366)));
};

var goodfire = fire.map(maskQA).select('burndate'); // only select good
var allfire = fire.map(maskQA3).select('burndate'); // no QA filter

// print the good fire image
print('good fire image is', goodfire);

/////////  calculate annual burned area, year by year  ////////////////
//////////////  2003 ////////////////////////////

// step 1: START of calculating annual burned area
var fire2003 = goodfire.filterDate('2003-01-01', '2003-12-31');

print('fire2003 is', fire2003);
print('burned area for fire2003 is: ', ee.Image(fire2003.first()).projection().nominalScale());

// reduce method to see whether the cell is burned (value >= 1)
var fire20033 = fire2003.sum().gte(1) ;
var fire20033 = fire20033.updateMask(fire20033);

// get annual burned area [burned value == 2, non-burn/mask == 0]
var fire20033 = fire20033.multiply(2);

// To overlay with Hansen's tree loss data, non-burn/mask must be replaced with 1
// in fire20034, burned ==2, non-burn ==1
var fire20034 = mask;
var fire20034 = fire20034.where(fire20033.eq(2), fire20033);

print('burned area for fire20034 is: ', fire20034);
print('fire20034 is scale/resolution', fire20034.projection().nominalScale());
print('fire20034 is projection', fire20034.projection());

// plot to see results
Map.addLayer(fire20033, {palette: ['red']}, "2003 burned area:: burned = 2/mask = 0");
//            {min: 1, max: 10, palette: ['black', 'green', 'blue']}, 'landsat mask');
 
Map.addLayer(fire20034, 
            {min: 1, max: 2, palette: ['green', 'blue']}, '2003 burned area::burned = 2/mask = 1');
 
///////// END of calculating annual burned area////////////////

//step 2: overlay forest cover loss with burned area, and calculate fire-induced forest loss
var lossyear = gfc2014.select(['lossyear']);
var treeCover = gfc2014.select(['treecover2000']);

// consider tree cover > 5 as forest, this threshold can be changed
var treeCover = treeCover.gt(5);
var treeCover = treeCover.updateMask(treeCover);

//range 1–13, representing loss detected primarily in the year 2001–2014
//1:2001; 2:2002; 3:2003
var loss2003 = lossyear.eq(3);
print('loss2003 projection: ', loss2003.projection());

Map.addLayer(loss2003, //{palette: ['yellow']}, ' forest loss in 2003, with mask = 0');
            {min: 0, max: 1, palette: ['green', 'blue']}, ' forest loss in 2003, with loss=1/mask or no tree loss = 0');
 
// in tree loss layer, replace tree loss site with 10, and no-tree loss with 1
var loss20031 = loss2003.multiply(9).add(1);

Map.addLayer(loss20031, //{palette: ['yellow']}, ' forest loss in 2003');
            {min: 1, max: 10, palette: ['green', 'blue']}, ' forest loss in 2003, with loss=10/mask or no tree loss = 1');
 
// combine fire layers with tree loss layers
// value == 12 (fire = 2 + tree loss = 10): fire-induced tree loss
// value == 11 (no fire = 1 + tree loss = 10): other caused tree loss
// value ==3 (fire = 2 + no tree loss = 1): non-stand replacement fire
// value == 2(no fire ==1 + no tree loss): stable forest in that year

var firetreeloss = fire20034.add(loss20031);
var firetreeloss = firetreeloss.updateMask(firetreeloss);

Map.addLayer(firetreeloss, 
            {min: 2, max: 12, palette: ['red', 'yellow', 'blue']}, 'fire induced forest loss in 2003, before tree cover mask');
 
Map.addLayer(treeCover, 
            {palette: ['green']}, 'tree cover in 2000');
 
// var firetreeloss2 = firetreeloss.where(treeCover.eq(1), treeCover);
var firetreeloss2 = firetreeloss.add(treeCover);
// var firetreeloss2 = firetreeloss2.multiply(mask.updateMask(mask));
var firetreeloss2 = firetreeloss2.updateMask(firetreeloss2);

Map.addLayer(firetreeloss2, 
            {min: 3, max: 13, palette: ['green', 'yellow', 'blue','red']}, 'fire induced forest loss in 2003, after tree cover mask');
 

// after applying treeCover mask, in IMAGE firetreeloss2
// value == 13 (fire = 2 + tree loss = 10): fire-induced tree loss
// value == 12 (no fire = 1 + tree loss = 10): other caused tree loss
// value == 4 (fire = 2 + no tree loss = 1): non-stand replacement fire
// value == 3 (no fire ==1 + no tree loss= 1): stable forest in that year
// value == 1: tree Cover at 2000 

print('the final fire- vs. other-caused tree loss is', firetreeloss2);

// END of step 2

// step 3, plot the results using styled layer descriptors
// refers to: https://developers.google.com/earth-engine/image_visualization

// Create zones using an expression, display.
var firetreeloss3 = firetreeloss2.expression(
    "(b('datamask') > 12) ? 5" +
      ": (b('datamask') > 11) ? 4" +
        ": (b('datamask') > 3) ? 3" +
              ": (b('datamask') > 2) ? 2" +
                  ": (b('datamask') > 0) ? 1" +
          ": 0"
);

var firetreeloss3 = firetreeloss3.updateMask(firetreeloss3);

// Define an SLD style of discrete intervals to apply to the image.
var sld_intervals =
'<RasterSymbolizer>' +
 ' <ColorMap  type="intervals" extended="false" >' +
    '<ColorMapEntry color="#f0f0f0" quantity="0" label="Non Forest"/>' +
    '<ColorMapEntry color="#a1d99b" quantity="1" label="Tree Cover at 2000"/>' +
    '<ColorMapEntry color="#31a354" quantity="2" label="Stable Forest"/>' +
    '<ColorMapEntry color="#ffeda0" quantity="3" label="Non stand replacement fire"/>' +
    '<ColorMapEntry color="#756bb1" quantity="4" label="Other indiced tree loss"/>' +
    '<ColorMapEntry color="#de2d26" quantity="5" label="Fire induce tree loss"/>' +
  '</ColorMap>' +
'</RasterSymbolizer>';

// Map.addLayer(firetreeloss3.sldStyle(sld_intervals), {}, 'User-defined classification styled');


var palette = ['f0f0f0', 'a1d99b', 'a1d99b', 'fee0d2','8856a7','de2d26'];
Map.addLayer(firetreeloss3,
             {min: 0, max: 5, palette: palette},
             'User-defined color scheme');
    
// END of step 3

// step 4: zonal statistics for tree loss/gain
// yet to be worked



