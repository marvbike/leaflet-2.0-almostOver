import {Map, Handler, Util} from 'leaflet';
import {closestLayerSnap} from 'leaflet-2-geometryutil';

// Extend Leaflet's Map options with AlmostOver options
Map.mergeOptions({
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
export class AlmostOverHandler extends Handler {

    initialize (map) {
        this._map = map;
        this._layers = [];
        this._previous = null;
        this._marker = null;
        this._buffer = 0;

        // A throttled version of the mousemove handler
        this._mouseMoveSampler = Util.throttle(this._onMouseMove, this._map.options.almostSamplingPeriod, this);
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
            } else if (Util.stamp(this._previous.layer) !== Util.stamp(closest.layer)) {
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
Map.addInitHook('addHandler', 'almostOver', AlmostOverHandler);
