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
    let currentSubtitle = '';     // 当前字幕文本
    let subtitleVisible = true;   // 字幕显示状态
    let subtitleTimer: number;    // 字幕更新定时器
    
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
            miniProgressBar: true,
            mutex: true,
            backdrop: true,
            playsInline: true,
            autoPlayback: true,
            theme: 'var(--b3-theme-primary)',
            lang: window.siyuan?.config?.lang?.toLowerCase() === 'en_us' ? 'en' : 'zh-cn',
            controls: [{
                position: 'right',
                name: 'subtitle',
                index: 10,
                html: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z"/></svg>',
                tooltip: i18n.player?.settings?.subtitleControlTip || '字幕开关',
                click: function() {
                    subtitleVisible = !subtitleVisible;
                    showMessage(subtitleVisible ? 
                        (i18n.player?.subtitle?.enabled || '已启用字幕') : 
                        (i18n.player?.subtitle?.disabled || '已禁用字幕'));
                }
            }]
        };
    }
    
    // 配置DASH媒体播放器
    function setupDashPlayer(playerOptions: any, type: string): void {
        if (type !== 'mpd') return;
        
        playerOptions.type = 'mpd';
        playerOptions.customType = {
            mpd: (video: HTMLVideoElement, url: string, art: any) => {
                if (art.dash) art.dash.destroy();
                
                const dashPlayer = dashjs.MediaPlayer().create();
                dashPlayer.initialize(video, url, art.option.autoplay);
                art.dash = dashPlayer;
                
                art.on('destroy', () => {
                    if (art.dash) art.dash.destroy();
                });
            }
        };
    }
    
    // 应用播放器配置
    function applyPlayerConfig(art: any, config: any): void {
        const safeConfig = { ...DEFAULT_CONFIG, ...config };
        art.volume = safeConfig.volume / 100;
        art.playbackRate = safeConfig.speed / 100;
        
        // 应用字幕设置
        subtitleVisible = safeConfig.showSubtitles !== undefined ? safeConfig.showSubtitles : true;
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
        art.on('ready', () => {
            applyPlayerConfig(art, config);
            startSubtitleTracking();
        });
        
        return art;
    }
    
    // 销毁播放器
    function destroyPlayer(): void {
        stopSubtitleTracking();
        if (art) {
            art.destroy(true);
            art = null;
        }
    }
    
    // 开始字幕追踪
    function startSubtitleTracking(): void {
        stopSubtitleTracking();
        subtitleTimer = window.setInterval(() => {
            if (!art) return;
            
            const subtitles = SubtitleManager.getSubtitles();
            if (!subtitles.length || !subtitleVisible) {
                currentSubtitle = '';
                return;
            }
            
            const time = art.currentTime;
            currentSubtitle = subtitles.find(
                cue => time >= cue.startTime && time <= cue.endTime
            )?.text || '';
        }, 200);
    }
    
    // 停止字幕追踪
    function stopSubtitleTracking(): void {
        if (subtitleTimer) window.clearInterval(subtitleTimer);
        subtitleTimer = null;
        currentSubtitle = '';
    }
    
    // ===================== 外部API =====================
    
    // 播放媒体
    export async function play(url: string, options: PlayOptions = {}): Promise<void> {
        try {
            // 重置状态
            currentChapter = null;
            loopCount = 0;
            currentSubtitle = '';
            
            // 创建新播放器（始终创建新实例以避免切换问题）
            destroyPlayer();
            
            // 加载弹幕插件
            const danmakuPlugin = await loadDanmaku(options);
            const plugins = danmakuPlugin ? [danmakuPlugin] : [];
            
            // 创建播放器配置
            const playerOptions = getPlayerOptions(url);
            if (plugins.length > 0) playerOptions.plugins = plugins;
            
            // 确定媒体类型
            const type = options.type === 'bilibili-dash' || url.endsWith('.mpd') ? 'mpd' : '';
            art = createPlayer(url, type, playerOptions);
            
            // 等待视频就绪
            await new Promise(resolve => {
                const handler = () => {
                    resolve(null);
                    art.off('video:loadeddata', handler);
                };
                art.on('video:loadeddata', handler);
            });
            
            // 应用选项
            if (options.headers) art.headers = options.headers;
            
            // 设置时间和循环
            if (options.startTime !== undefined) {
                if (options.isLoop && options.endTime !== undefined) {
                    setPlayTime(options.startTime, options.endTime);
                } else {
                    setPlayTime(options.startTime);
                }
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
        if (!config?.enableDanmaku) return null;
        
        const isBilibili = ['bilibili', 'bilibili-dash'].includes(options.type || '');
        if (!isBilibili || !options.cid) return null;
        
        try {
            const danmakuUrl = await DanmakuManager.loadBiliDanmaku(options.cid, config);
            if (danmakuUrl) {
                return DanmakuManager.createDanmakuPlugin(danmakuUrl);
            }
        } catch (e) {
            console.error('[弹幕] 加载失败:', e);
        }
        return null;
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
    
    // 设置字幕可见性
    export function setSubtitleVisible(visible: boolean): void {
        subtitleVisible = visible;
        if (config) config.showSubtitles = visible;
    }
    
    // 快捷API
    export function seekTo(time: number): void { if (art) art.currentTime = time; }
    export function getCurrentTime(): number { return art?.currentTime || 0; }
    export function getScreenshotDataURL(): Promise<string | null> { return art ? art.getDataURL() : Promise.resolve(null); }
    
    // ===================== 生命周期 =====================
    
    onMount(() => { if (playerContainer) createPlayer(); });
    onDestroy(() => {
        stopSubtitleTracking();
        destroyPlayer();
    });
</script>

<div class="artplayer-app" bind:this={playerContainer}>
    {#if currentSubtitle && subtitleVisible}
        <div class="floating-subtitle">{currentSubtitle}</div>
    {/if}
</div>