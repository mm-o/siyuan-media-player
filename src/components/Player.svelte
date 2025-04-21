<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Artplayer from 'artplayer';
    import * as dashjs from 'dashjs';
    import type { PlayOptions } from '../core/types';
    import { SubtitleManager } from '../core/subtitle';
    import { DanmakuManager } from '../core/danmaku';
    
    // ===================== 属性和状态 =====================
    
    export let app: any;          // 应用实例
    export let config: any;       // 播放器配置
    export let i18n: any;         // 国际化对象
    
    let art: any = null;          // Artplayer 实例
    let playerContainer: HTMLDivElement;    // 播放器容器元素
    let currentChapter: { start: number; end: number; } | null = null;  // 当前循环片段
    let loopCount = 0;            // 当前循环次数
    
    const DEFAULT_CONFIG = { volume: 70, speed: 100, loopCount: 3 };
    
    // ===================== 核心功能 =====================
    
    // 获取播放器基础配置
    function getPlayerOptions(url = ''): any {
        const safeConfig = { ...DEFAULT_CONFIG, ...config };
        return {
            container: playerContainer,
            url,
            volume: safeConfig.volume / 100,
            autoplay: true,
            pip: true,
            autoSize: true,
            autoMini: true,
            setting: true,
            flip: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            fullscreenWeb: true,
            subtitleOffset: true,
            miniProgressBar: true,
            mutex: true,
            backdrop: true,
            playsInline: true,
            autoPlayback: true,
            theme: 'var(--b3-theme-primary)',
            lang: window.siyuan?.config?.lang?.toLowerCase() === 'en_us' ? 'en' : 'zh-cn',
            subtitle: { url: '', type: '', encoding: 'utf-8', escape: true },
            controls: [{
                position: 'right',
                name: 'subtitle',
                index: 10,
                html: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z"/></svg>',
                tooltip: i18n.player?.settings?.subtitleControlTip || '字幕开关',
                click: function() {
                    // 切换字幕显示状态
                    this.subtitle.show = !this.subtitle.show;
                    showMessage(this.subtitle.show ? 
                        (i18n.player?.subtitle?.enabled || '已启用字幕') : 
                        (i18n.player?.subtitle?.disabled || '已禁用字幕'));
                },
            }]
        };
    }
    
    // 配置DASH媒体播放器
    function setupDashPlayer(playerOptions: any, type: string): void {
        if (type !== 'mpd') return;
        
        const originalWarn = console.warn;
        console.warn = (...args) => 
            !args[0]?.includes('[CapabilitiesFilter]') && originalWarn.apply(console, args);
        
        playerOptions.type = 'mpd';
        playerOptions.customType = {
            mpd: (video: HTMLVideoElement, url: string, art: any) => {
                if (art.dash) art.dash.destroy();
                
                const dashPlayer = dashjs.MediaPlayer().create();
                dashPlayer.initialize(video, url, art.option.autoplay);
                art.dash = dashPlayer;
                
                art.on('destroy', () => {
                    if (art.dash) art.dash.destroy();
                    console.warn = originalWarn;
                });
            }
        };
    }
    
    // 应用播放器配置
    function applyPlayerConfig(art: any, config: any): void {
        const safeConfig = { ...DEFAULT_CONFIG, ...config };
        art.volume = safeConfig.volume / 100;
        art.playbackRate = safeConfig.speed / 100;
        
        // 根据配置设置字幕显示状态
        if (art.subtitle && art.subtitle.url) {
            art.subtitle.show = safeConfig.showSubtitles !== undefined ? safeConfig.showSubtitles : true;
        }
    }
    
    // 创建播放器
    function createPlayer(url = '', type = '', options = null): any {
        destroyPlayer();
        
        const playerOptions = options || getPlayerOptions(url);
        setupDashPlayer(playerOptions, type);
        
        art = new Artplayer(playerOptions);
        
        // 循环播放处理
        art.on('video:timeupdate', () => {
            if (!currentChapter) return;
            
            if (art.currentTime >= currentChapter.end) {
                const maxLoopCount = config?.loopCount || DEFAULT_CONFIG.loopCount;
                
                if (maxLoopCount > 0 && loopCount >= maxLoopCount) {
                    currentChapter = null;
                    loopCount = 0;
                    art.notice.show = i18n.player.loop.endMessage;
                    return;
                }
                
                art.currentTime = currentChapter.start;
                art.notice.show = i18n.player.loop.currentLoop
                    .replace('${current}', ++loopCount)
                    .replace('${total}', maxLoopCount);
            }
        });
        
        // 应用初始配置
        art.on('ready', () => applyPlayerConfig(art, config));
        
        return art;
    }
    
    // 销毁播放器
    function destroyPlayer(): void {
        if (art) {
            art.destroy(true);
            art = null;
        }
    }
    
    // ===================== 外部API =====================
    
    // 播放媒体
    export async function play(url: string, options: PlayOptions = {}): Promise<void> {
        try {
            // 重置状态
            currentChapter = null;
            loopCount = 0;
            
            const type = options.type === 'bilibili-dash' || url.endsWith('.mpd') ? 'mpd' : '';
            
            // 在创建播放器前加载资源
            const [subtitle, danmakuPlugin] = await Promise.all([
                SubtitleManager.getSubtitleForMedia(url),
                loadDanmaku(options)
            ]);
            
            // 添加弹幕插件（即使是空弹幕）
            const finalDanmakuPlugin = danmakuPlugin || DanmakuManager.createEmptyDanmakuPlugin();
            
            // 创建或更新播放器
            if (!art || type === 'mpd') {
                const playerOptions = getPlayerOptions(url);
                
                // 设置字幕和弹幕
                if (subtitle) {
                    playerOptions.subtitle = subtitle;
                    console.info('[字幕] 已加载:', subtitle.url);
                }
                
                playerOptions.plugins = [finalDanmakuPlugin];
                art = createPlayer(url, type, playerOptions);
            } else {
                // 对于有弹幕的情况，重新创建播放器以避免弹幕冲突
                destroyPlayer();
                const playerOptions = getPlayerOptions(url);
                
                // 设置字幕和弹幕
                if (subtitle) {
                    playerOptions.subtitle = subtitle;
                    console.info('[字幕] 已加载:', subtitle.url);
                }
                
                playerOptions.plugins = [finalDanmakuPlugin];
                art = createPlayer(url, type, playerOptions);
            }
            
            // 等待视频就绪
            await waitForVideoReady();
            
            // 应用选项
            if (options.headers) art.headers = options.headers;
            
            // 设置时间和循环
            if (options.startTime !== undefined) {
                options.isLoop && options.endTime !== undefined
                    ? setPlayTime(options.startTime, options.endTime)
                    : setPlayTime(options.startTime);
            }

            art.play();
        } catch (error) {
            console.error("[Player] " + i18n.player.error.playFailed, error);
            showMessage(i18n.player.error.playRetry);
            
            if (art?.container) {
                art.container.dispatchEvent(new CustomEvent('streamError', {
                    detail: { url, options }
                }));
            }
        }
    }
    
    // 加载弹幕插件
    async function loadDanmaku(options: PlayOptions): Promise<any> {
        const isBilibili = ['bilibili', 'bilibili-dash'].includes(options.type || '');
        if (!isBilibili || !options.cid) return null;
        
        try {
            const danmakuUrl = await DanmakuManager.loadBiliDanmaku(options.cid, config);
            if (danmakuUrl) {
                const plugin = DanmakuManager.createDanmakuPlugin(danmakuUrl);
                console.info('[弹幕] 成功加载B站弹幕');
                return plugin;
            }
        } catch (e) {
            console.error('[弹幕] 加载失败:', e);
        }
        return null;
    }
    
    // 等待视频就绪
    async function waitForVideoReady(): Promise<void> {
        return new Promise<void>(resolve => {
            const handler = () => {
                resolve();
                art.off('video:loadeddata', handler);
            };
            art.on('video:loadeddata', handler);
        });
    }
    
    // 设置播放时间和循环片段
    export function setPlayTime(start: number, end?: number): void {
        if (!art) return;
        
        try {
            loopCount = 0;
            currentChapter = end !== undefined ? { start, end } : null;
            art.currentTime = start;
        } catch (error) {
            console.error('[Player] ' + i18n.player.error.setTimeFailed, error);
            showMessage(i18n.player.error.setTimeFailed);
        }
    }
    
    // 设置循环播放
    export function setLoop(isLoop: boolean, loopTimes?: number): void {
        if (!art) return;
        
        try {
            art.loop = isLoop;
            if (loopTimes !== undefined && config) config.loopCount = loopTimes;
        } catch (error) {
            console.error('[Player] ' + i18n.player.error.setLoopFailed, error);
        }
    }
    
    // 更新播放器配置
    export function updateConfig(newConfig: any): void {
        if (!art) return;
        applyPlayerConfig(art, newConfig);
    }
    
    // 快捷API
    export function seekTo(time: number): void { if (art) art.currentTime = time; }
    export function getCurrentTime(): number { return art?.currentTime || 0; }
    export function getScreenshotDataURL(): Promise<string | null> { return art ? art.getDataURL() : Promise.resolve(null); }
    
    // ===================== 生命周期 =====================
    
    onMount(() => { if (playerContainer) createPlayer(); });
    onDestroy(destroyPlayer);
</script>

<div class="artplayer-app" bind:this={playerContainer} />