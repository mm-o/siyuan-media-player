import {
    Plugin,
    showMessage,
    openTab
} from "siyuan";
import "@/styles/components.scss";

// @ts-ignore
import Player from "./components/Player.svelte";
// @ts-ignore
import PlayList from "./components/PlayList.svelte";
// @ts-ignore
import Setting from "./components/Setting.svelte";
// @ts-ignore
import Assistant from "./components/Assistant.svelte";
import { ConfigManager } from "./core/config";
import { url, isSupportedMediaLink } from './core/utils';
import type { MediaItem, ComponentInstance } from './core/types';
import { PlayerType } from './core/types';
import { createMediaPlayerAPI } from './api';
import { player as playerUtils, mediaNotes, doc, link } from './core/document';
import { playMedia, openWithExternalPlayer } from './core/media';
import { AListManager } from './core/alist';

/**
 * 思源笔记媒体播放器插件
 */
export default class MediaPlayerPlugin extends Plugin {
    private configManager: ConfigManager;
    private components = new Map<string, ComponentInstance>();
    private events = new Map<string, EventListener>();
    private currentItem: MediaItem = null;
    private loopStartTime: number = null;
    private tabInstance: any = null;
    private linkClickHandler: ((e: MouseEvent) => void) | null = null;
    private pendingTime: {start?: number, end?: number} | null = null;
    
    public api: any;
    public playerAPI: any;
    
    async onload() {
        this.configManager = new ConfigManager(this);
        await this.configManager.load();
        
        // 初始化API和事件
        this.initAPI();
        this.registerEvents();
        
        // 添加UI和功能
        this.addSidebar();
        this.registerHotkeys();
        this.loadUserScripts();
    }
    
    onunload() {
        // 清理事件和组件
        this.events.forEach((handler, event) => window.removeEventListener(event, handler));
        this.components.forEach(component => { if (component?.$destroy) try { component.$destroy(); } catch (e) {} });
        this.components.clear();
        
        if (this.linkClickHandler) document.removeEventListener('click', this.linkClickHandler, true);
        
        // 清理状态和UI元素
        this.currentItem = this.loopStartTime = this.tabInstance = this.pendingTime = null;
        this.playerAPI = this.linkClickHandler = null;
        (window as any).siyuanMediaPlayer = null;
        document.querySelectorAll('[id^="media-player-script-"]').forEach(el => el.remove());
    }
    
    private initAPI() {
        // 播放器API
        this.playerAPI = {
            seekTo: (time: number) => this.components.get('player')?.seekTo?.(time),
            getCurrentTime: () => this.components.get('player')?.getCurrentTime?.() || 0,
            getScreenshotDataURL: () => this.components.get('player')?.getScreenshotDataURL?.() || Promise.resolve(null),
            setPlayTime: (start: number, end?: number) => this.components.get('player')?.setPlayTime?.(start, end),
            setLoopSegment: (start: number, end: number) => this.components.get('player')?.setPlayTime?.(start, end),
            setLoop: (isLoop: boolean, loopTimes?: number) => this.components.get('player')?.setLoop?.(isLoop, loopTimes),
            updateConfig: (newConfig: any) => this.components.get('player')?.updateConfig?.(newConfig),
            getCurrentMedia: () => this.currentItem,
            pause: () => this.components.get('player')?.pause?.(),
            resume: () => this.components.get('player')?.resume?.(),
            play: (url: string, options: any) => this.components.get('player')?.play?.(url, options),
            
            playMediaItem: async (mediaItem: MediaItem) => {
                if (!mediaItem) return;
                
                try {
                    this.currentItem = mediaItem;
                    
                    await playMedia(
                        mediaItem, 
                        this.playerAPI, 
                        this.configManager, 
                        (item) => {
                            this.currentItem = item;
                            window.dispatchEvent(new CustomEvent('siyuanMediaPlayerUpdate', {
                                detail: { player: this.playerAPI, currentItem: this.currentItem }
                            }));
                            
                            // 应用待处理的时间
                            if (this.pendingTime) {
                                setTimeout(() => {
                                    if (this.pendingTime.end) {
                                        this.playerAPI.setLoopSegment(this.pendingTime.start, this.pendingTime.end);
                                    } else if (this.pendingTime.start) {
                                        this.playerAPI.seekTo(this.pendingTime.start);
                                    }
                                    this.pendingTime = null;
                                }, 500);
                            }
                        }, 
                        this.i18n
                    );
                    
                    // 设置时间戳和循环片段
                    if (mediaItem.startTime !== undefined && !this.pendingTime) {
                        const startTime = Number(mediaItem.startTime);
                        if (mediaItem.endTime !== undefined) {
                            this.playerAPI.setPlayTime(startTime, Number(mediaItem.endTime));
                        } else {
                            this.playerAPI.seekTo(startTime);
                        }
                    }
                } catch (error) {
                    console.error("播放媒体失败:", error);
                    showMessage(this.i18n.player?.error?.playFailed || "播放失败");
                }
            },
            
            createTimestampLink: async (isLoop = false, startTime?: number, endTime?: number, subtitleText?: string) => {
                if (!this.playerAPI || !this.currentItem) return null;
                
                const config = await this.configManager.getConfig();
                const time = startTime ?? this.playerAPI.getCurrentTime();
                const loopEnd = isLoop ? (endTime ?? time + 3) : endTime;
                
                return link(this.currentItem, config, time, loopEnd, subtitleText);
            }
        };
        
        // 外部API
        this.api = createMediaPlayerAPI(this.name, () => this.openTab());
    }
    
    private registerEvents() {
        // 全局事件处理
        const handlers = {
            'siyuanMediaPlayerUpdate': (e: CustomEvent<any>) => {
                const { currentItem } = e.detail;
                this.currentItem = currentItem;
                
                if (this.tabInstance?.parent?.updateTitle && this.currentItem?.title) {
                    try { this.tabInstance.parent.updateTitle(this.currentItem.title); } catch {}
                }
                
                const assistant = this.components.get('assistant');
                if (assistant?.$set) assistant.$set({ currentMedia: this.currentItem });
            },
            
            'addMediaToPlaylist': (e: CustomEvent<any>) => {
                const playlist = this.components.get('playlist');
                if (!playlist?.addMedia) return;
                
                const { url, autoPlay = true, ...options } = e.detail || {};
                playlist.addMedia(url, { autoPlay, ...options });
                
                if (autoPlay) this.openTab();
            },
            
            'directMediaPlay': (e: CustomEvent<any>) => {
                this.openTab();
                setTimeout(() => {
                    const item = e.detail;
                    if (!item) return;
                    
                    this.currentItem = item;
                    window.dispatchEvent(new CustomEvent('playMediaItem', { detail: item }));
                    
                    const playlist = this.components.get('playlist');
                    if (playlist?.$set) playlist.$set({ currentItem: item });
                }, 300);
            },
            
            'playMediaItem': (e: CustomEvent) => this.playerAPI.playMediaItem(e.detail),
            
            'mediaPlayerAction': (e: CustomEvent<any>) => {
                const { action, loopStartTime } = e.detail;
                if (!this.components.get('player') || !this.currentItem) return;
                
                try {
                    const settings = this.configManager.getConfig();
                    
                    switch (action) {
                        case 'loopSegment': {
                            const currentTime = this.playerAPI.getCurrentTime();
                            if (loopStartTime !== null && currentTime > loopStartTime) {
                                this.playerAPI.createTimestampLink(true, loopStartTime, currentTime)
                                    .then(link => {
                                        if (link) {
                                            doc.insert(link, settings, this.i18n);
                                            showMessage(this.i18n.loopSegment?.insertSuccess || "循环片段链接已插入");
                                        }
                                    });
                                this.loopStartTime = null;
                            } else {
                                this.loopStartTime = currentTime;
                            }
                            
                            window.dispatchEvent(new CustomEvent('loopSegmentResponse', {
                                detail: { loopStartTime: this.loopStartTime }
                            }));
                            break;
                        }
                        case 'mediaNotes':
                            mediaNotes.create(this.currentItem, settings, this.playerAPI, this.i18n);
                            break;
                        case 'screenshot':
                            playerUtils.screenshot(this.playerAPI, this.currentItem, settings, this.i18n);
                            break;
                        case 'timestamp':
                            playerUtils.timestamp(this.playerAPI, this.currentItem, settings, this.i18n);
                            break;
                    }
                } catch (error) {
                    console.error(`${action} 操作失败:`, error);
                    showMessage(this.i18n.controlBar?.[action]?.error || `${action} 操作失败`);
                }
            },
            
            'updatePlayerConfig': (e: CustomEvent) => {
                if (this.playerAPI?.updateConfig) {
                    this.playerAPI.updateConfig(e.detail);
                    this.loadUserScripts();
                }
            },
            
            'mediaPlayerTabChange': (e: CustomEvent) => {
                const tabId = e.detail?.tabId;
                if (tabId) {
                    const container = document.querySelector('.media-player-sidebar-content');
                    if (container) this.showTabContent(tabId, container as HTMLElement);
                }
            },
            
            'mediaEnded': (e: CustomEvent) => {
                if (e.detail?.loopPlaylist) {
                    const playlist = this.components.get('playlist');
                    if (playlist?.playNext) playlist.playNext();
                }
            },
            
            'reloadUserScripts': () => this.loadUserScripts()
        };
        
        // 注册全局事件
        Object.entries(handlers).forEach(([event, handler]) => {
            const listener = handler.bind(this) as EventListener;
            this.events.set(event, listener);
            window.addEventListener(event, listener);
        });
        
        // 链接点击处理
        this.linkClickHandler = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.matches('span[data-type="a"]')) return;
            
            const urlStr = target.getAttribute('data-href');
            if (!urlStr || !isSupportedMediaLink(urlStr)) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const config = await this.configManager.getConfig();
                const playerType = e.ctrlKey ? PlayerType.BROWSER : config.settings.playerType;
                
                // 外部播放器直接打开
                if (playerType === PlayerType.POT_PLAYER || playerType === PlayerType.BROWSER) {
                    const error = await openWithExternalPlayer(urlStr, playerType, config.settings.playerPath);
                    if (error) showMessage(error);
                    return;
                }
                
                // 解析媒体URL和时间戳
                const { mediaUrl: parsedUrl, startTime, endTime } = url.parseTime(urlStr);
                const mediaInfo = url.getMediaInfo(parsedUrl);
                
                // 记录时间
                if (startTime !== undefined) {
                    this.pendingTime = { start: startTime, end: endTime };
                }
                
                // 丝滑跳转处理
                if (this.currentItem && url.isSameMedia(this.currentItem, urlStr)) {
                    console.log(`丝滑跳转: ${startTime}${endTime ? `-${endTime}` : ''}`);
                    setTimeout(() => {
                        if (endTime !== undefined) {
                            this.playerAPI.setLoopSegment(startTime, endTime);
                        } else if (startTime !== undefined) {
                            this.playerAPI.seekTo(startTime);
                        }
                        this.pendingTime = null;
                    }, 100);
                    return;
                }
                
                // 确保播放器标签已打开
                const playerTabExists = !!document.querySelector('.media-player-tab');
                if (!playerTabExists) {
                    this.openTab();
                    await this.waitForElement('.media-player-tab', 2000);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // AList媒体特殊处理
                if (mediaInfo.source === 'alist') {
                    if (!await AListManager.initFromConfig(config)) {
                        showMessage("未连接到AList服务器，请先在设置中配置AList");
                        return;
                    }
                    
                    const result = await AListManager.handleAListMediaLink(parsedUrl, { startTime, endTime });
                    if (result.success && result.mediaItem) {
                        window.dispatchEvent(new CustomEvent('directMediaPlay', { detail: result.mediaItem }));
                        return;
                    } else if (result.error) {
                        showMessage(`处理AList媒体失败: ${result.error}`);
                        return;
                    }
                }
                
                // 播放新媒体
                const playlist = this.components.get('playlist');
                if (playlist?.addMedia) {
                    playlist.addMedia(parsedUrl, { autoPlay: true, startTime, endTime });
                } else {
                    window.dispatchEvent(new CustomEvent('directMediaPlay', { 
                        detail: {
                            id: `direct-${Date.now()}`,
                            title: url.title(parsedUrl),
                            url: parsedUrl,
                            type: url.type(parsedUrl),
                            startTime,
                            endTime
                        }
                    }));
                }
            } catch (error) {
                console.error("播放媒体失败:", error);
                showMessage("播放失败，请重试");
            }
        };
        document.addEventListener('click', this.linkClickHandler, true);
    }
    
    private addSidebar() {
        // 添加图标
        const iconId = 'siyuan-media-player-icon';
        this.addIcons(`
        <symbol id="${iconId}" viewBox="0 0 1024 1024">
            <path d="M753.265 105.112c12.57 12.546 12.696 32.81 0.377 45.512l-0.377 0.383-73.131 72.992L816 224c70.692 0 128 57.308 128 128v448c0 70.692-57.308 128-128 128H208c-70.692 0-128-57.308-128-128V352c0-70.692 57.308-128 128-128l136.078-0.001-73.13-72.992c-12.698-12.674-12.698-33.222 0-45.895 12.697-12.674 33.284-12.674 45.982 0l119.113 118.887h152.126l119.114-118.887c12.697-12.674 33.284-12.674 45.982 0zM457 440c-28.079 0-51 22.938-51 51v170c0 9.107 2.556 18.277 7 26 15.025 24.487 46.501 32.241 71 18l138-84c7.244-4.512 13.094-10.313 17-17 15.213-24.307 7.75-55.875-16-71l-139-85c-7.994-5.355-17.305-8-27-8z"/>
        </symbol>
        `);
        
        // 添加侧边栏
        this.addDock({
            type: "SiyuanMediaSidebar",
            config: {
                position: "RightTop",
                size: { width: 400, height: 480 },
                icon: iconId,
                title: this.i18n.sidebar?.title || "媒体助手"
            },
            data: { plugin: this },
            init: function() {
                const container = this.element;
                container.classList.add('media-player-sidebar');
                const contentEl = document.createElement('div');
                contentEl.className = 'media-player-sidebar-content';
                container.appendChild(contentEl);
                (this.data.plugin as MediaPlayerPlugin).showTabContent('playlist', contentEl);
            }
        });
    }
    
    private showTabContent(tabId: string, container: HTMLElement) {
        const components = { playlist: PlayList, assistant: Assistant, settings: Setting };
        
        // 已有组件则激活并返回
        container.querySelectorAll('[data-tab-id]').forEach(
            el => el.classList.toggle('fn__none', el.getAttribute('data-tab-id') !== tabId)
        );
        
        if (this.components.has(tabId)) {
            window.dispatchEvent(new CustomEvent('mediaPlayerTabActivate', { detail: { tabId } }));
            return;
        }
        
        // 创建新组件
        const el = document.createElement('div');
        el.setAttribute('data-tab-id', tabId);
        container.appendChild(el);
        
        // 组件配置和创建
        const component = components[tabId];
        if (!component) return;
        
        const props = { 
            configManager: this.configManager, 
            i18n: this.i18n,
            allTabs: ['playlist', 'assistant', 'settings'],
            activeTabId: tabId,
            api: this.playerAPI,
            ...(tabId === 'playlist' && { currentItem: this.currentItem }),
            ...(tabId === 'settings' && { group: 'media-player' }),
            ...(tabId === 'assistant' && { 
                player: this.playerAPI, 
                currentMedia: this.currentItem,
                insertContentCallback: content => doc.insert(content, this.configManager.getConfig(), this.i18n),
                createTimestampLinkCallback: this.playerAPI.createTimestampLink
            })
        };
        
        const instance = new component({ target: el, props });
        this.components.set(tabId, instance);
        
        // 设置特定组件事件
        if (tabId === 'playlist') {
            instance.$on?.('play', (event: CustomEvent<any>) => {
                this.openTab();
                this.currentItem = event.detail;
                setTimeout(() => window.dispatchEvent(new CustomEvent('playMediaItem', { detail: event.detail })), 300);
            });
        } else if (tabId === 'settings') {
            instance.$on?.('changed', (event: CustomEvent<any>) => {
                window.dispatchEvent(new CustomEvent('updatePlayerConfig', { detail: event.detail.settings }));
            });
        }
        
        window.dispatchEvent(new CustomEvent('mediaPlayerTabActivate', { detail: { tabId } }));
    }
    
    private openTab() {
        const self = this;
        const config = this.configManager.getConfig();
        const openMode = config?.settings?.openMode || 'default';
        
        this.addTab({
            type: "custom_tab",
            init() {
                // 创建播放器区域
                const container = document.createElement("div");
                container.className = "media-player-container";
                
                const playerArea = document.createElement("div");
                playerArea.className = "player-area";
                playerArea.style.cssText = "width:100%;height:100%;position:relative;z-index:1;";
                
                const mediaPlayerTab = document.createElement("div");
                mediaPlayerTab.className = "media-player-tab";
                
                mediaPlayerTab.appendChild(document.createElement("div"))
                    .className = "content-area";
                mediaPlayerTab.querySelector('.content-area').appendChild(playerArea);
                container.appendChild(mediaPlayerTab);
                
                // 初始化播放器
                self.tabInstance = this;
                self.components.set('player', new Player({
                    target: playerArea,
                    props: {
                        config: config.settings,
                        i18n: self.i18n,
                        currentItem: self.currentItem,
                        api: self.playerAPI
                    }
                }));
                
                // 注册全局API
                (window as any).siyuanMediaPlayer = self.playerAPI;
                window.dispatchEvent(new CustomEvent('siyuanMediaPlayerUpdate', {
                    detail: { player: self.playerAPI, currentItem: self.currentItem }
                }));
                
                this.element.appendChild(container);
            },
            destroy() {
                const player = self.components.get('player');
                if (player?.$destroy) {
                    try { player.$destroy(); } catch (e) {}
                    self.components.delete('player');
                }
                self.tabInstance = null;
                (window as any).siyuanMediaPlayer = null;
                self.currentItem = null;
                self.loopStartTime = null;
                self.pendingTime = null;
            }
        });

        // 打开标签页
        const tabOptions: any = {
            app: this.app,
            custom: {
                icon: "siyuan-media-player-icon",
                title: this.i18n.name,
                id: this.name + "custom_tab"
            }
        };
        
        // 设置打开模式
        if (openMode === 'right') tabOptions.position = 'right';
        else if (openMode === 'bottom') tabOptions.position = 'bottom';
        else if (openMode === 'window') tabOptions.custom.asWindow = true;
        
        openTab(tabOptions);
    }
    
    private registerHotkeys() {
        [
            ['screenshot', this.i18n.screenshot?.text],
            ['timestamp', this.i18n.timestamp?.text],
            ['loopSegment', this.i18n.loopSegment?.text],
            ['mediaNotes', this.i18n.controlBar?.mediaNotes?.name]
        ].forEach(([key, text]) => this.addCommand({
            langKey: key as string,
            langText: text as string,
            hotkey: "",
            callback: () => {
                if (!this.components.get('player') || !this.currentItem) {
                    showMessage(this.i18n.openPlayer);
                    this.openTab();
                    return;
                }
                
                window.dispatchEvent(new CustomEvent('mediaPlayerAction', {
                    detail: { action: key, loopStartTime: this.loopStartTime }
                }));
            }
        }));
    }
    
    private async loadUserScripts() {
        document.querySelectorAll('[id^="media-player-script-"]').forEach(el => el.remove());
        
        try {
            if (!window.require || !window.siyuan?.config?.system?.workspaceDir) return;
            
            const fs = window.require('fs'), path = window.require('path');
            const dir = path.join(window.siyuan.config.system.workspaceDir, 'data/storage/petal/siyuan-media-player');
            
            (this.configManager.getConfig().settings.scripts || [])
                .filter(s => s.enabled)
                .forEach(s => {
                    const file = path.join(dir, s.name);
                    if (fs.existsSync(file)) {
                        document.head.appendChild(
                            Object.assign(document.createElement('script'), {
                                id: `media-player-script-${s.name}`,
                                textContent: fs.readFileSync(file, 'utf-8')
                            })
                        );
                    }
                });
        } catch (e) {}
    }
    
    private async waitForElement(selector: string, timeout = 2000): Promise<Element | null> {
        const element = document.querySelector(selector);
        if (element) return element;
        
        return new Promise<Element | null>(resolve => {
            const endTime = Date.now() + timeout;
            const checkInterval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element || Date.now() > endTime) {
                    clearInterval(checkInterval);
                    resolve(element);
                }
            }, 50);
        });
    }
}
