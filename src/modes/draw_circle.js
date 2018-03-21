const CommonSelectors = require("../lib/common_selectors");
const Circle = require("../feature_types/circle");
const doubleClickZoom = require("../lib/double_click_zoom");
const Constants = require("../constants");
const isEventAtCoordinates = require("../lib/is_event_at_coordinates");
const createVertex = require("../lib/create_vertex");
const distance = require("../lib/geo_distance");
const createGeoJSONCircle = require("../lib/create_geo_json_circle");

module.exports = function(ctx) {

  const polygon = new Circle(ctx, {
    type: Constants.geojsonTypes.FEATURE,
    properties: {
      circle: true,
      class: Constants.types.CIRCLE
    },
    geometry: {
      type: Constants.geojsonTypes.POLYGON,
      coordinates: [[]]
    }
  });
  let currentVertexPosition = 0;

  if (ctx._test) ctx._test.polygon = polygon;
  ctx.store.add(polygon);

  return {
    start() {
      ctx.store.clearSelected();
      doubleClickZoom.disable(ctx);
      ctx.ui.queueMapClasses({ mouse: Constants.cursors.ADD });
      ctx.ui.setActiveButton(Constants.types.CIRCLE);
      this.on("mousemove", CommonSelectors.true, e => {
        if (currentVertexPosition === 0) return;
        const radius = distance(polygon.center[1], polygon.center[0], e.lngLat.lat, e.lngLat.lng);
        const coords = createGeoJSONCircle(polygon.center, radius);
        polygon.radius = radius;
        polygon.setCoordinates([coords]);
        currentVertexPosition = coords.length;
        if (CommonSelectors.isVertex(e)) {
          ctx.ui.queueMapClasses({ mouse: Constants.cursors.POINTER });
        }
      });
      this.on("click", CommonSelectors.true, (e) => {
        if (currentVertexPosition > 0) {
          return ctx.events.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [polygon.id] });
        }
        ctx.ui.queueMapClasses({ mouse: Constants.cursors.ADD });

        polygon.center = [e.lngLat.lng, e.lngLat.lat];
        const coords = createGeoJSONCircle([e.lngLat.lng, e.lngLat.lat], 100);
        polygon.setCoordinates([coords]);
        currentVertexPosition = coords.length;
      });
      this.on("click", CommonSelectors.isVertex, () => {
        return ctx.events.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [polygon.id] });
      });
      this.on("keyup", CommonSelectors.isEscapeKey, () => {
        ctx.store.delete([polygon.id], { silent: true });
        ctx.events.changeMode(Constants.modes.SIMPLE_SELECT);
      });
      this.on("keyup", CommonSelectors.isEnterKey, () => {
        ctx.events.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [polygon.id] });
      });
      ctx.events.actionable({
        combineFeatures: false,
        uncombineFeatures: false,
        trash: true
      });
    },

    stop: function() {
      ctx.ui.queueMapClasses({ mouse: Constants.cursors.NONE });
      doubleClickZoom.enable(ctx);
      ctx.ui.setActiveButton();

      // check to see if we've deleted this feature
      if (ctx.store.get(polygon.id) === undefined) return;

      //remove last added coordinate
      polygon.removeCoordinate(`0.${currentVertexPosition}`);
      if (polygon.isValid()) {
        ctx.map.fire(Constants.events.CREATE, {
          features: [polygon.toGeoJSON()]
        });
      }
      else {
        ctx.store.delete([polygon.id], { silent: true });
        ctx.events.changeMode(Constants.modes.SIMPLE_SELECT, {}, { silent: true });
      }
    },

    render(geojson, callback) {
      const isActivePolygon = geojson.properties.id === polygon.id;
      const parentClass = polygon.properties.class;
      geojson.properties.active = (isActivePolygon) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
      if (!isActivePolygon) return callback(geojson);

      // Don't render a polygon until it has two positions
      // (and a 3rd which is just the first repeated)
      if (geojson.geometry.coordinates.length === 0) return;

      const coordinateCount = geojson.geometry.coordinates[0].length;

      // If we have fewer than two positions (plus the closer),
      // it's not yet a shape to render
      if (coordinateCount < 3) return;

      geojson.properties.meta = Constants.meta.FEATURE;

      if (coordinateCount > 4) {
        // Add a start position marker to the map, clicking on this will finish the feature
        // This should only be shown when we're in a valid spot
        callback(createVertex(polygon.id, geojson.geometry.coordinates[0][0], "0.0", false, parentClass));
        let endPos = geojson.geometry.coordinates[0].length - 3;
        callback(createVertex(polygon.id, geojson.geometry.coordinates[0][endPos], `0.${endPos}`, false, parentClass));
      }

      // If we have more than two positions (plus the closer),
      // render the Polygon
      if (coordinateCount > 3) {
        return callback(geojson);
      }
    },
    trash() {
      ctx.store.delete([polygon.id], { silent: true });
      ctx.events.changeMode(Constants.modes.SIMPLE_SELECT);
    }
  };
};
