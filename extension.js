import Clutter from "gi://Clutter";
import GnomeBluetooth from "gi://GnomeBluetooth";
import GObject from "gi://GObject";
import St from "gi://St";

import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init(devices) {
            super._init(0.0, _("Bluetooth battery indicator"));
            this._devices = devices;
            this._container = new St.BoxLayout();
            this._order = [];

            this.add_child(this._container);

            // This list is probably empty
            for (const device of devices) {
                this._insert_device(device, true);
            }

            // const item = new PopupMenu.PopupMenuItem(_("Show Notification"));
            // item.connect("activate", () => {
                // Main.notify(_("Whatʼs up, folks?"));
            // });

            // this.menu.addMenuItem(item);

            this._devices.connectObject(
                "items-changed", this._onItemsChanged.bind(this),
                this,
            );
        }

        // if the device is connected and has a battery percentage field its mac address will be pushed into the _order array
        // so that its index can be used to insert/remove it from the indicator 
        _onItemsChanged(devices, offset, removed, added) {
            for (let i = offset; i < (offset + added); i++) {
                this._insert_device(this._get_device(i), true);
            }

            for (let i = 0; i < removed; i++) {
                this._remove_device(this._get_device(offset), true);
            }
        }

        _get_device(n) {
            return this._devices.get_item(n);
        }

        _get_device_icon(n) {
            return this._container.get_child_at_index(2 * n);
        }

        _get_device_label(n) {
            return this._container.get_child_at_index(2 * n + 1);
        }

        _should_insert_device(device) {
            return !this._order.includes(device.address)
                && device.connected
                && device.battery_type === GnomeBluetooth.BatteryType.PERCENTAGE;
        }

        _just_insert_device(device) {
            const icon = new St.Icon({ icon_name: `${device.icon}-symbolic`, style_class: "system-status-icon" });
            const label = new St.Label({ y_align: Clutter.ActorAlign.CENTER, text: `${device.battery_percentage}%` });

            this._order.push(device.address);
            this._container.add_child(icon);
            this._container.insert_child_above(label, icon);
        }

        _insert_device(device, init = true) {
            if (this._should_insert_device(device)) {
                this._just_insert_device(device);
            }

            if (init) {
                device.connectObject(
                    "notify", this._onNotify.bind(this),
                    this,
                );
            }
        }

        _remove_device(device, destroy = true) {
            const index = this._order.indexOf(device.address);

            if (index < 0) return;

            const icon = this._get_device_icon(index);
            const label = this._get_device_label(index);

            this._order.splice(index, 1);
            this._container.remove_child(icon);
            this._container.remove_child(label);

            if (destroy) {
                device.disconnectObject(this);
            }
        }

        _toggle_device(device) {
            if (device.connected && device.battery_type === GnomeBluetooth.BatteryType.PERCENTAGE) {
                if (!this._order.includes(device.address)) {
                    this._just_insert_device(device);
                }
            } else {
                this._remove_device(device, false);
            }
        }

        _onNotify(device, spec) {
            const key = spec.get_name();
            const value = device[key];

            if (key === "battery-percentage") {
                const index = this._order.indexOf(device.address);

                if (index < 0) return;

                this._get_device_label(index).set_text(`${value}%`);
            } else if (key === "battery-type" || key === "active") {
                this._toggle_device(device);
            }
        }

        // FIXME: not sure yet how to destroy a widget
        destroy() {
            this._devices.disconnectObject(this);
            super.destroy();
        }
    }
);

export default class IndicatorExampleExtension extends Extension {
    enable() {
        this._client = new GnomeBluetooth.Client();
        this._indicator = new Indicator(this._client.get_devices());

        this._client.connectObject(
            "device-added", this._onDeviceAdded.bind(this),
            "device-removed", this._onDeviceRemoved.bind(this),
            this,
        );

        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._client.disconnectObject(this);

        this._indicator.destroy();
        this._indicator = null;
    }

    // FIXME: don't know what to do with this yet
    _onDeviceAdded(client, device) {}

    // FIXME: don't know what to do with this yet
    _onDeviceRemoved(client, device) {}
}
