import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const REFRESH_SECONDS = 300;

function findBunx() {
    return GLib.find_program_in_path('bunx')
        ?? GLib.build_filenamev([GLib.get_home_dir(), '.bun', 'bin', 'bunx']);
}

function formatCost(cost) {
    return `$${cost.toFixed(2)}`;
}

export default class AiCostTrayExtension extends Extension {
    enable() {
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        this._label = new St.Label({
            text: 'AI: …',
            y_align: 2 /* Clutter.ActorAlign.CENTER */,
        });
        this._indicator.add_child(this._label);

        this._breakdownItems = [];
        const refreshItem = new PopupMenu.PopupMenuItem('Refresh now');
        refreshItem.connect('activate', () => this._refresh());
        this._indicator.menu.addMenuItem(refreshItem);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        Main.panel.addToStatusArea(this.uuid, this._indicator, 999, 'left');

        this._refresh();
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, REFRESH_SECONDS, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        this._indicator?.destroy();
        this._indicator = null;
        this._label = null;
        this._breakdownItems = null;
    }

    _refresh() {
        this._cancellable?.cancel();
        this._cancellable = new Gio.Cancellable();

        let proc;
        try {
            proc = Gio.Subprocess.new(
                [findBunx(), 'ccusage', 'daily', '--last', '1', '--json'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            this._showError();
            return;
        }

        proc.communicate_utf8_async(null, this._cancellable, (source, result) => {
            let stdout;
            try {
                [, stdout] = source.communicate_utf8_finish(result);
                if (!source.get_successful())
                    throw new Error('ccusage exited with a non-zero status');
            } catch (e) {
                if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    this._showError();
                return;
            }

            try {
                const data = JSON.parse(stdout);
                const today = data.daily?.[0];
                if (!today)
                    throw new Error('no daily entry in ccusage output');
                this._showUsage(today);
            } catch (e) {
                this._showError();
            }
        });
    }

    _showUsage(today) {
        if (!this._label)
            return;
        this._label.set_text(formatCost(today.totalCost));

        this._clearBreakdown();
        const breakdowns = today.modelBreakdowns ?? [];
        if (breakdowns.length === 0) {
            this._addBreakdownItem('No model usage today');
        } else {
            for (const model of breakdowns)
                this._addBreakdownItem(`${model.modelName}: ${formatCost(model.cost)}`);
        }
    }

    _showError() {
        if (!this._label)
            return;
        this._label.set_text('AI: --');
        this._clearBreakdown();
        this._addBreakdownItem('ccusage unavailable');
    }

    _clearBreakdown() {
        for (const item of this._breakdownItems)
            item.destroy();
        this._breakdownItems = [];
    }

    _addBreakdownItem(text) {
        const item = new PopupMenu.PopupMenuItem(text, { reactive: false });
        this._indicator.menu.addMenuItem(item);
        this._breakdownItems.push(item);
    }
}
