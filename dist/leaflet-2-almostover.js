(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet')) :
    typeof define === 'function' && define.amd ? define(['exports', 'leaflet'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.LeafletAlmostOver = {}, global.L));
})(this, (function (exports, leaflet) { 'use strict';

    /**
     * @fileOverview Leaflet Geometry utilities for distances and linear referencing.
     * @name GeometryUtil
     */

    // Internal helper function, formerly L.Polyline._flat
    function isFlat (latlngs) {
        // true if it's a flat array of latlngs; false if nested
        return !leaflet.Util.isArray(latlngs[0]) || (typeof latlngs[0][0] !== 'object' && typeof latlngs[0][0] !== 'undefined');
    }

    /**
     * Shortcut function for planar distance between a {LatLng} and a segment (A-B).
     * @param {L.Map} map Leaflet map to be used for this method
     * @param {LatLng} latlng - The position to search
     * @param {LatLng} latlngA geographical point A of the segment
     * @param {LatLng} latlngB geographical point B of the segment
     * @returns {Number} planar distance
     */
    function distanceSegment (map, latlng, latlngA, latlngB) {
        const p = map.latLngToLayerPoint(latlng),
            p1 = map.latLngToLayerPoint(latlngA),
            p2 = map.latLngToLayerPoint(latlngB);
        return leaflet.LineUtil.pointToSegmentDistance(p, p1, p2);
    }

    /**
     * Returns the closest point of a {LatLng} on the segment (A-B)
     *
     * @tutorial closest
     *
     * @param {L.Map} map Leaflet map to be used for this method
     * @param {LatLng} latlng - The position to search
     * @param {LatLng} latlngA geographical point A of the segment
     * @param {LatLng} latlngB geographical point B of the segment
     * @returns {LatLng} Closest geographical point
     */
    function closestOnSegment (map, latlng, latlngA, latlngB) {
        let maxzoom = map.getMaxZoom();
        if (maxzoom === Infinity)
            maxzoom = map.getZoom();
        const p = map.project(latlng, maxzoom),
            p1 = map.project(latlngA, maxzoom),
            p2 = map.project(latlngB, maxzoom),
            closest = leaflet.LineUtil.closestPointOnSegment(p, p1, p2);
        return map.unproject(closest, maxzoom);
    }

    /**
     * Returns the closest point of a {LatLng} on a {Circle}
     *
     * @tutorial closest
     *
     * @param {Circle} circle - A Circle defined by a center and a radius
     * @param {LatLng} latLng - The position to search
     * @returns {LatLng} Closest geographical point on the circle circumference
     */
    function closestOnCircle (circle, latLng) {
        const center = circle.getLatLng();
        const circleRadius = circle.getRadius();
        const radius = typeof circleRadius === 'number' ? circleRadius : circleRadius.radius;
        const x = latLng.lng;
        const y = latLng.lat;
        const cx = center.lng;
        const cy = center.lat;
        // dx and dy is the vector from the circle's center to latLng
        const dx = x - cx;
        const dy = y - cy;

        // distance between the point and the circle's center
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate the closest point on the circle by adding the normalized vector to the center
        const tx = cx + (dx / distance) * radius;
        const ty = cy + (dy / distance) * radius;

        return new leaflet.LatLng(ty, tx);
    }


    /**
     * Returns the closest latlng on layer.
     *
     * Accept nested arrays
     *
     * @tutorial closest
     *
     * @param {L.Map} map Leaflet map to be used for this method
     * @param {Array<LatLng>|Array<Array<LatLng>>|Polyline|Polygon} layer - Layer that contains the result
     * @param {LatLng} latlng - The position to search
     * @param {?boolean} [vertices=false] - Whether to restrict to path vertices.
     * @returns {Object} An object with `latlng` and `distance` properties, or `null`.
     */
    function closest (map, layer, latlng, vertices) {
        let latlngs,
            mindist = Infinity,
            result = null,
            i, n, distance, subResult;

        if (layer instanceof Array) {
            if (layer[0] instanceof Array && typeof layer[0][0] !== 'number') {
                for (i = 0; i < layer.length; i++) {
                    subResult = closest(map, layer[i], latlng, vertices);
                    if (subResult && subResult.distance < mindist) {
                        mindist = subResult.distance;
                        result = subResult;
                    }
                }
                return result;
            } else if (layer[0] instanceof leaflet.LatLng ||
                typeof layer[0][0] === 'number' ||
                typeof layer[0].lat === 'number') {
                layer = new leaflet.Polyline(layer);
            } else {
                return result;
            }
        }

        if (!(layer instanceof leaflet.Polyline))
            return result;

        latlngs = JSON.parse(JSON.stringify(layer.getLatLngs().slice(0)));

        if (layer instanceof leaflet.Polygon) {
            const addLastSegment = function (latlngsArr) {
                if (isFlat(latlngsArr)) {
                    latlngsArr.push(latlngsArr[0]);
                } else {
                    for (let i = 0; i < latlngsArr.length; i++) {
                        addLastSegment(latlngsArr[i]);
                    }
                }
            };
            addLastSegment(latlngs);
        }

        if (!isFlat(latlngs)) {
            for (i = 0; i < latlngs.length; i++) {
                subResult = closest(map, latlngs[i], latlng, vertices);
                if (subResult.distance < mindist) {
                    mindist = subResult.distance;
                    result = subResult;
                }
            }
            return result;
        } else {
            if (vertices) {
                for (i = 0, n = latlngs.length; i < n; i++) {
                    const ll = new leaflet.LatLng(latlngs[i]);
                    distance = this.distance(map, latlng, ll);
                    if (distance < mindist) {
                        mindist = distance;
                        result = ll;
                        result.distance = distance;
                    }
                }
                return result;
            }

            for (i = 0, n = latlngs.length; i < n - 1; i++) {
                const latlngA = new leaflet.LatLng(latlngs[i]);
                const latlngB = new leaflet.LatLng(latlngs[i + 1]);
                distance = distanceSegment(map, latlng, latlngA, latlngB);
                if (distance <= mindist) {
                    mindist = distance;
                    result = closestOnSegment(map, latlng, latlngA, latlngB);
                    result.distance = distance;
                }
            }
            return result;
        }
    }

    /**
     * Returns the closest layer to latlng among a list of layers.
     *
     * @tutorial closest
     *
     * @param {L.Map} map Leaflet map to be used for this method
     * @param {Array<L.ILayer>} layers Set of layers
     * @param {LatLng} latlng - The position to search
     * @returns {object} `{layer, latlng, distance}` or `null` if list is empty;
     */
    function closestLayer (map, layers, latlng) {
        let mindist = Infinity,
            result = null,
            ll = null,
            distance = Infinity;

        for (let i = 0, n = layers.length; i < n; i++) {
            const layer = layers[i];
            if (layer instanceof leaflet.LayerGroup) {
                const subResult = closestLayer(map, layer.getLayers(), latlng);
                if (subResult.distance < mindist) {
                    mindist = subResult.distance;
                    result = subResult;
                }
            } else {
                if (layer instanceof leaflet.Circle) {
                    ll = closestOnCircle(layer, latlng);
                    distance = this.distance(map, latlng, ll);
                } else if (typeof layer.getLatLng == 'function') {
                    ll = layer.getLatLng();
                    distance = this.distance(map, latlng, ll);
                } else {
                    ll = closest(map, layer, latlng);
                    if (ll) distance = ll.distance;
                }
                if (distance < mindist) {
                    mindist = distance;
                    result = {
                        layer: layer,
                        latlng: ll,
                        distance: distance
                    };
                }
            }
        }
        return result;
    }


    /**
     * Returns the closest position from specified {LatLng} among specified layers,
     * with a maximum tolerance in pixels, providing snapping behaviour.
     *
     * @tutorial closest
     *
     * @param {L.Map} map Leaflet map to be used for this method
     * @param {Array<ILayer>} layers - A list of layers to snap on.
     * @param {LatLng} latlng - The position to snap
     * @param {?Number} [tolerance=Infinity] - Maximum number of pixels.
     * @param {?boolean} [withVertices=true] - Snap to layers vertices or segment points (not only vertex)
     * @returns {object} with snapped {LatLng} and snapped {Layer} or null if tolerance exceeded.
     */
    function closestLayerSnap (map, layers, latlng, tolerance = Infinity, withVertices = true) {
        const result = closestLayer(map, layers, latlng);
        if (!result || result.distance > tolerance)
            return null;

        if (withVertices && typeof result.layer.getLatLngs == 'function') {
            const closestResult = closest(map, result.layer, result.latlng, true);
            if (closestResult.distance < tolerance) {
                result.latlng = closestResult;
                result.distance = this.distance(map, closestResult, latlng);
            }
        }
        return result;
    }

    // Extend Leaflet's Map options with AlmostOver options
    leaflet.Map.mergeOptions({
        // @option almostOver: Boolean = true
        // Set it to false to disable this plugin
        almostOver: true,

        // @option almostDistance: Number = 25
        // Tolerance in pixels to consider a layer "almost over"
        almostDistance: 25,

        // @option almostSamplingPeriod: Number = 50
        // Time in ms to throttle mousemove events for performance.
        almostSamplingPeriod: 50,

        // @option almostOnMouseMove: Boolean = true
        // Set to false to disable mousemove tracking and only use clicks.
        almostOnMouseMove: true,
    });


    /**
     * @class AlmostOverHandler
     * @extends L.Handler
     *
     * This handler fires 'almost:over', 'almost:out', and 'almost:move' events on the map
     * when the mouse is near a layer. It also fires 'almost:click' and 'almost:dblclick'.
     *
     * It requires the Leaflet.GeometryUtil plugin.
     */
    class AlmostOverHandler extends leaflet.Handler {

        initialize (map) {
            this._map = map;
            this._layers = [];
            this._previous = null;
            this._marker = null;
            this._buffer = 0;

            // A throttled version of the mousemove handler
            this._mouseMoveSampler = leaflet.Util.throttle(this._onMouseMove, this._map.options.almostSamplingPeriod, this);
        }

        /**
         * Adds the necessary event listeners to the map.
         */
        addHooks () {
            if (this._map.options.almostOnMouseMove) {
                this._map.on('mousemove', this._mouseMoveSampler, this);
            }
            this._map.on('click dblclick', this._onMouseClick, this);

            // A listener to compute the buffer distance in map units
            const computeBuffer = () => {
                if (!this._map) return;
                const p1 = this._map.layerPointToLatLng([0, 0]);
                const p2 = this._map.layerPointToLatLng([this._map.options.almostDistance, this._map.options.almostDistance]);
                this._buffer = p1.distanceTo(p2);
            };

            this._map.on('viewreset zoomend', computeBuffer, this);
            this._map.whenReady(computeBuffer, this);
        }

        /**
         * Removes the event listeners from the map.
         */
        removeHooks () {
            this._map.off('mousemove', this._mouseMoveSampler, this);
            this._map.off('click dblclick', this._onMouseClick, this);
            // Note: 'viewreset' and 'zoomend' listeners for computeBuffer are not removed,
            // as they are lightweight and handler removal is not always guaranteed.
        }

        /**
         * Adds a layer to be considered for "almost over" events.
         * @param {L.Layer} layer
         */
        addLayer (layer) {
            if (typeof layer.eachLayer === 'function') {
                layer.eachLayer(l => this.addLayer(l), this);
            } else {
                // If using a spatial index like LayerIndexMixin, you would index it here.
                // e.g., if (typeof this.indexLayer === 'function') { this.indexLayer(layer); }
                this._layers.push(layer);
            }
        }

        /**
         * Removes a layer from "almost over" consideration.
         * @param {L.Layer} layer
         */
        removeLayer (layer) {
            if (typeof layer.eachLayer === 'function') {
                layer.eachLayer(l => this.removeLayer(l), this);
            } else {
                // If using a spatial index, you would unindex it here.
                // e.g., if (typeof this.unindexLayer === 'function') { this.unindexLayer(layer); }
                const index = this._layers.indexOf(layer);
                if (index >= 0) {
                    this._layers.splice(index, 1);
                }
            }
            this._previous = null;
        }

        /**
         * Finds the closest layer to a given LatLng.
         * @param {L.LatLng} latlng
         * @returns {Object|null} An object with layer, latlng, and distance, or null.
         */
        getClosest (latlng) {
            const distance = this._map.options.almostDistance;
            let snaplist = this._layers;

            // If using a spatial index, you would search it here for efficiency.
            // e.g., if (typeof this.searchBuffer === 'function') {
            //   snaplist = this.searchBuffer(latlng, this._buffer);
            // }

            return closestLayerSnap(this._map, snaplist, latlng, distance, false);
        }

        /**
         * Handles the throttled mousemove event.
         * @private
         * @param {L.MouseEvent} e
         */
        _onMouseMove (e) {
            if (!e.latlng) return;

            const closest = this.getClosest(e.latlng);

            if (closest) {
                if (!this._previous) {
                    // Fire 'over' event if mouse enters a layer's proximity
                    this._map.fire('almost:over', {layer: closest.layer, latlng: closest.latlng});
                } else if (leaflet.Util.stamp(this._previous.layer) !== leaflet.Util.stamp(closest.layer)) {
                    // Fire 'out' and 'over' if mouse moves from one layer's proximity to another
                    this._map.fire('almost:out', {layer: this._previous.layer});
                    this._map.fire('almost:over', {layer: closest.layer, latlng: closest.latlng});
                }

                // Fire 'move' event while mouse is in proximity
                this._map.fire('almost:move', {layer: closest.layer, latlng: closest.latlng});
            } else if (this._previous) {
                    // Fire 'out' event if mouse leaves a layer's proximity
                    this._map.fire('almost:out', {layer: this._previous.layer});
                }
            this._previous = closest;
        }

        /**
         * Handles click and dblclick events.
         * @private
         * @param {L.MouseEvent} e
         */
        _onMouseClick (e) {
            const closest = this.getClosest(e.latlng);
            if (closest) {
                this._map.fire(`almost:${e.type}`, {layer: closest.layer, latlng: closest.latlng});
            }
        }
    }

    // Add the handler to the map's initialization hooks
    leaflet.Map.addInitHook('addHandler', 'almostOver', AlmostOverHandler);

    exports.AlmostOverHandler = AlmostOverHandler;

}));
//# sourceMappingURL=leaflet-2-almostover.js.map
