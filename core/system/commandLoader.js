import fs from "fs";
import path from "path";
import chalk from "chalk";
import { fileURLToPath, pathToFileURL } from "url";
import Logger from "../../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsFolder = path.join(__dirname, "../../cmds");

class CommandRegistry {
  constructor() {
    this.comandos = new Map();
    this.plugins = {};
    this.pluginCache = new Map();
    
    // Bind legacy globals for backwards compatibility
    global.comandos = this.comandos;
    global.plugins = this.plugins;
  }

  registerPlugin(imported, pluginName) {
    const defaultExport = imported.default;
    const commands = Array.isArray(defaultExport) ? defaultExport : (defaultExport ? [defaultExport] : []);
    
    const pluginObj = {};
    for (const key of Object.getOwnPropertyNames(imported)) {
      pluginObj[key] = imported[key];
    }
    
    // Fallback for before/after/all exported inside the default export
    const beforeFn = imported.before || commands.find(c => typeof c.before === 'function')?.before || null;
    const afterFn = imported.after || commands.find(c => typeof c.after === 'function')?.after || null;
    const allFn = imported.all || commands.find(c => typeof c.all === 'function')?.all || null;
    
    if (beforeFn) pluginObj.before = beforeFn;
    if (afterFn) pluginObj.after = afterFn;
    if (allFn) pluginObj.all = allFn;
    if (imported.customPrefix) pluginObj.customPrefix = imported.customPrefix;
    
    const firstCmd = commands[0];
    Object.defineProperty(pluginObj, 'priority', {
      value: imported.priority || firstCmd?.priority || 0,
      writable: true, enumerable: true, configurable: true
    });
    this.plugins[pluginName] = pluginObj;
    
    for (const comando of commands) {
      if (!comando?.command || typeof comando.run !== 'function') continue;
      
      const cmds = Array.isArray(comando.command) ? comando.command : [comando.command];
      for (const cmd of cmds) {
        if (cmd) {
          this.comandos.set(cmd.toLowerCase(), {
            ...comando,
            pluginName,
            run: comando.run,
            category: comando.category || 'uncategorized',
            isOwner: comando.isOwner || false,
            isAdmin: comando.isAdmin || false,
            botAdmin: comando.botAdmin || false,
            isPrivate: comando.isPrivate || false,
            heavy: comando.heavy || false,
            economy: comando.economy || false,
            desc: comando.desc || comando.description || '',
            usage: comando.usage || '',
            cooldown: comando.cooldown || 0,
            customPrefix: comando.customPrefix || null,
            before: imported.before || comando.before || null,
            after: imported.after || comando.after || null,
            info: comando.info || {}
          });
        }
      }
    }
  }

  deregisterPlugin(pluginName) {
    for (const [cmd, data] of this.comandos.entries()) {
      if (data.pluginName === pluginName) {
        this.comandos.delete(cmd);
      }
    }
    delete this.plugins[pluginName];
  }

  getCommand(cmd) {
    return this.comandos.get(cmd.toLowerCase());
  }

  getPlugins() {
    return this.plugins;
  }

  async loadPluginFile(fullPath, pluginName) {
    try {
      const mtime = fs.statSync(fullPath).mtimeMs;
      const cached = this.pluginCache.get(fullPath);
      let imported;
      if (cached && cached.mtime === mtime) {
        imported = cached.imported;
      } else {
        const modulePath = `${pathToFileURL(path.resolve(fullPath)).href}?update=${Date.now()}`;
        imported = await import(modulePath);
        this.pluginCache.set(fullPath, { mtime, imported });
      }
      this.registerPlugin(imported, pluginName);
    } catch (e) {
      Logger.error(`Error loading plugin ${pluginName} (${fullPath}):`, e);
    }
  }
}

const registry = new CommandRegistry();

async function seeCommands(dir = commandsFolder) {
  const items = fs.readdirSync(dir);
  for (const fileOrFolder of items) {
    const fullPath = path.join(dir, fileOrFolder);
    if (fs.lstatSync(fullPath).isDirectory()) {
      await seeCommands(fullPath);
      continue;
    }
    if (!fileOrFolder.endsWith(".js")) continue;
    
    const pluginName = fileOrFolder.replace(".js", "");
    await registry.loadPluginFile(fullPath, pluginName);
  }
  if (dir === commandsFolder) {
    console.log(chalk.cyanBright(`[ ℹ ] Total de comandos registrados: ${registry.comandos.size}`));
  }
}

const debounceMap = new Map();
global.reload = async (_ev, fullPath) => {
  if (!fullPath.endsWith(".js")) return;
  if (debounceMap.has(fullPath)) clearTimeout(debounceMap.get(fullPath));
  debounceMap.set(fullPath, setTimeout(async () => {
    debounceMap.delete(fullPath);
    const filename = path.basename(fullPath);
    const pluginName = filename.replace(".js", "");
    if (!fs.existsSync(fullPath)) {
      Logger.warn(`Plugin eliminado: ${filename}`);
      registry.pluginCache.delete(fullPath);
      registry.deregisterPlugin(pluginName);
      return;
    }
    try {
      await registry.loadPluginFile(fullPath, pluginName);
      Logger.success(`Plugin recargado: ${filename}`);
    } catch (e) {
      Logger.error(`Error al recargar ${filename}`, e);
    }
  }, 300));
};

Object.freeze(global.reload);
const watchers = [];
function startWatcher() {
  for (const w of watchers) { try { w.close(); } catch {} }
  watchers.length = 0;
  function watchDir(dir) {
    try {
      const w = fs.watch(dir, (event, filename) => {
        if (filename && filename.endsWith('.js')) global.reload(event, path.join(dir, filename));
      });
      watchers.push(w);
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.lstatSync(full).isDirectory()) watchDir(full);
      }
    } catch {}
  }
  watchDir(commandsFolder);
}
startWatcher();

// Auto-limpieza para carpetas eliminadas
setInterval(async () => {
  for (const fullPath of registry.pluginCache.keys()) {
    try {
      await fs.promises.access(fullPath);
    } catch {
      global.reload('rename', fullPath);
    }
  }
}, 10000);

export default seeCommands;
export { registry };
