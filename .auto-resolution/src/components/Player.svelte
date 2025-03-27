<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Artplayer from 'artplayer';
    import * as dashjs from 'dashjs';
    import type { PlayOptions } from '../core/types';
    
    // ===================== 属性和状态 =====================
    
    export let app: any;          // 应用实例（保留以保持API兼容）
    export let config: any;       // 播放器配置
    export let i18n: any;         // 国际化对象
    
    // 播放器状态
    let art: any = null;          // Artplayer 实例
    let playerContainer: HTMLDivElement;   // 播放器容器元素
    let currentChapter: { start: number; end: number; } | null = null;  // 当前循环片段
    let loopCount = 0;            // 当前循环次数
    
    // 默认配置
    const DEFAULT_CONFIG = {
        volume: 70,
        speed: 100,
        loopCount: 3
    };
    
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
        };
    }
    
    // 创建和管理播放器
    function createPlayer(url = '', type = ''): any {
        destroyPlayer();
        
        const playerOptions = getPlayerOptions(url);
        
        // 处理DASH媒体
        if (type === 'mpd') {
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
            const safeConfig = { ...DEFAULT_CONFIG, ...config };
            art.volume = safeConfig.volume / 100;
            art.playbackRate = safeConfig.speed / 100;
        });
        
        return art;
    }
    
    // 销毁播放器
    function destroyPlayer(): void {
        if (art) {
            art.destroy(true);
            art = null;
        }
    }
    
    // ===================== 核心功能：播放控制 =====================
    
    // ===================== 外部API =====================
    
    // 播放媒体
    export async function play(url: string, options: PlayOptions = {}): Promise<void> {
        return artInstance;
    }
    
    /**
     * 播放媒体
     * @param url 媒体URL
     * @param options 播放选项
     */
    export async function play(url: string, options: PlayOptions = {}): Promise<void> {
        try {
            // 重置状态
            currentChapter = null;
            loopCount = 0;
            
            const type = options.type === 'bilibili-dash' || url.endsWith('.mpd') ? 'mpd' : '';
            
            // 创建或更新播放器
            if (!art || type === 'mpd') {
                art = createPlayer(url, type);
            } else {
                if (art.dash) {
                    try {
                        art.dash.destroy();
                        art.dash = null;
                    } catch (e) {
                        console.warn('[Player] ' + i18n.player.error.clearDash, e);
                    }
                }
                
                art.option.customType = {};
                art.option.type = '';
                art.url = url;
            }
            
            // 等待视频就绪
            await new Promise<void>(resolve => {
                const handler = () => {
                    resolve();
                    art.off('video:loadeddata', handler);
                };
                art.on('video:loadeddata', handler);
            });
            
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
            
            // 跳转到开始时间
            art.currentTime = start;
        } catch (error) {
            console.error('[Player] 设置播放时间失败:', error);
            showMessage('设置播放时间失败');
        }
    }
    
    // 更新播放器配置
    export function updateConfig(newConfig: any): void {
        if (!art) return;
        
        const safeConfig = { ...DEFAULT_CONFIG, ...newConfig };
        art.volume = safeConfig.volume / 100;
        art.playbackRate = safeConfig.speed / 100;
    }
    
    // 跳转到指定时间
    export function seekTo(time: number): void {
        if (art) art.currentTime = time;
    }
    
    // 获取当前播放时间
    export function getCurrentTime(): number {
        return art?.currentTime || 0;
    }
    
    // 获取当前帧截图
    export function getScreenshotDataURL(): Promise<string | null> {
        return art ? art.getDataURL() : Promise.resolve(null);
    }
    
    // ===================== 生命周期 =====================
    
    onMount(() => {
        if (playerContainer) createPlayer();
    });
    
    onDestroy(destroyPlayer);
</script>

<div class="artplayer-app" bind:this={playerContainer}>
    <!-- Artplayer 将在这里初始化 -->
</div>