import type { Plugin } from "siyuan";
import type { Config } from "./types";

/**
 * 配置管理器
 */
export class ConfigManager {
    private plugin: Plugin;
    private config: Config;
    
    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.config = this.getDefaultConfig();
    }
    
    /**
     * 获取默认配置
     */
    private getDefaultConfig(): Config {
        return {
            playlists: [
                {
                    id: 'default',
                    name: this.plugin.i18n.playList?.defaultList || '默认列表',
                    items: [],
                    isFixed: true
                },
                {
                    id: 'favorites',
                    name: this.plugin.i18n.playList?.favorites || '收藏夹',
                    items: [],
                    isFixed: true
                }
            ],
            settings: {
                volume: 70,
                speed: 100,
                hotkey: true,
                loop: false,
                insertAtCursor: true,
            }
        };
    }
    
    /**
     * 加载配置
     */
    async load() {
        try {
            const saved = await this.plugin.loadData('config.json');
            if (saved) {
                // 保留固定列表的i18n名称
                if (saved.playlists) {
                    // 更新固定列表的名称为当前语言
                    saved.playlists = saved.playlists.map(playlist => {
                        if (playlist.id === 'default' && playlist.isFixed) {
                            return {
                                ...playlist,
                                name: this.plugin.i18n.playList?.defaultList || '默认列表'
                            };
                        }
                        if (playlist.id === 'favorites' && playlist.isFixed) {
                            return {
                                ...playlist,
                                name: this.plugin.i18n.playList?.favorites || '收藏夹'
                            };
                        }
                        return playlist;
                    });
                }
                
                this.config = {
                    ...this.config,
                    ...saved
                };
            }
        } catch (e) {
            console.error('Failed to load config:', e);
        }
        return this.config;
    }
    
    /**
     * 保存配置
     */
    async save() {
        try {
            await this.plugin.saveData('config.json', this.config);
        } catch (e) {
            console.error('Failed to save config:', e);
        }
    }
    
    /**
     * 更新播放列表
     */
    async updatePlaylists(playlists: Config['playlists']) {
        this.config.playlists = playlists;
        await this.save();
    }
    
    /**
     * 更新设置
     */
    async updateSettings(settings: Config['settings']) {
        this.config.settings = settings;
        await this.save();
    }
    
    /**
     * 获取配置
     */
    getConfig() {
        return this.config;
    }
} 