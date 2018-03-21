var Polygon = require("./polygon");
const Constants = require("../constants");
const createGeoJSONCircle = require("../lib/create_geo_json_circle");

var Circle = function(ctx, geojson) {
  Polygon.call(this, ctx, geojson);
  const toGeoJSON = this.toGeoJSON.bind(this);
  this.toGeoJSON = function () {
    const geoJSON = toGeoJSON();
    return Object.assign({}, geoJSON, {
      properties: Object.assign({}, this.properties, {
        circle: true,
        class: Constants.types.CIRCLE
      }),
      geometry: Object.assign({}, geoJSON.geometry, {
        center: this.center,
        radius: this.radius
      })
    });
  };
};

Circle.prototype = Object.create(Polygon.prototype);

Circle.prototype.updateCenter = function (delta) {
  this.center = [
    this.center[0] + delta.lng,
    this.center[1] + delta.lat
  ];

  const coords = createGeoJSONCircle([this.center[0], this.center[1]], this.radius);
  this.setCoordinates([coords]);
};

module.exports = Circle;
