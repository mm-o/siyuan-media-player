<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Artplayer from 'artplayer';
    import * as dashjs from 'dashjs';
    import type { PlayOptions } from '../core/types';
    
    // ===================== 属性和状态 =====================
    
    export let app: any;          // 应用实例（保留以保持API兼容）
    export let config: any;       // 播放器配置
    
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
    
    // ===================== 核心功能：播放器创建 =====================
    
    /**
     * 获取基础播放器选项
     * @param url 媒体URL
     * @returns Artplayer配置选项
     */
    function getBasePlayerOptions(url = ''): any {
        const safeConfig = { ...DEFAULT_CONFIG, ...config };
        
        return {
            container: playerContainer,
            url: url,
            volume: safeConfig.volume / 100,
            isLive: false,
            muted: false,
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
            lang: 'zh-cn',
        };
    }
    
    /**
     * 创建默认播放器
     * @param url 媒体URL
     * @returns Artplayer实例
     */
    function createDefaultPlayer(url = ''): any {
        destroyPlayer();
        
        const playerOptions = getBasePlayerOptions(url);
        art = new Artplayer(playerOptions);
        
        addLoopHandler(art);
        
        art.on('ready', () => {
            updateConfig(config);
        });
        
        return art;
    }
    
    /**
     * 创建DASH播放器
     * @param url DASH媒体URL（MPD文件）
     * @param options 播放选项
     * @returns Artplayer实例
     */
    function createDashPlayer(url: string, options: PlayOptions = {}): any {
        destroyPlayer();
        
        // 保存原始的console.warn
        const originalWarn = console.warn;
        
        // 重写console.warn来过滤dash.js的警告
        console.warn = (...args) => {
            if (!args[0]?.includes('[CapabilitiesFilter]')) {
                originalWarn.apply(console, args);
            }
        };
        
        const playerOptions = {
            ...getBasePlayerOptions(url),
            type: 'mpd',
            customType: {
                mpd: function (video: HTMLVideoElement, url: string, art: any) {
                    // 清理可能存在的dash实例
                    if (art.dash) {
                        art.dash.destroy();
                        art.dash = null;
                    }

                    // 创建新的dash实例
                    const dashPlayer = dashjs.MediaPlayer().create();
                    dashPlayer.initialize(video, url, art.option.autoplay);
                    art.dash = dashPlayer;

                    // 注册清理函数
                    art.on('destroy', () => {
                        if (art.dash) {
                            art.dash.destroy();
                            art.dash = null;
                        }
                        // 恢复原始的console.warn
                        console.warn = originalWarn;
                    });
                }
            }
        };
        
        art = new Artplayer(playerOptions);
        
        addLoopHandler(art);
        
        if (options.headers) {
            art.headers = options.headers;
        }
        
        return art;
    }
    
    /**
     * 销毁播放器实例及相关资源
     */
    function destroyPlayer(): void {
        if (art) {
            art.destroy(true);
            art = null;
        }
    }
    
    // ===================== 核心功能：播放控制 =====================
    
    /**
     * 添加循环播放处理器
     * @param artInstance Artplayer实例
     * @returns 更新后的实例
     */
    function addLoopHandler(artInstance: any): any {
        artInstance.on('video:timeupdate', () => {
            if (currentChapter && artInstance.currentTime >= currentChapter.end) {
                const maxLoopCount = config?.loopCount || 3;
                
                if (maxLoopCount > 0 && loopCount >= maxLoopCount) {
                    // 达到循环上限，重置状态
                    currentChapter = null;
            loopCount = 0;
                    artInstance.notice.show = '循环播放结束';
                    return;
                }
                
                // 循环播放
                artInstance.currentTime = currentChapter.start;
                loopCount++;
                artInstance.notice.show = `第 ${loopCount}/${maxLoopCount} 次循环`;
            }
        });
        
        return artInstance;
    }
    
    /**
     * 播放媒体
     * @param url 媒体URL
     * @param options 播放选项
     */
    export async function play(url: string, options: PlayOptions = {}): Promise<void> {
        try {
            // 重置循环状态
            currentChapter = null;
            loopCount = 0;
            
            // 判断媒体类型
            const isMPD = options.type === 'bilibili-dash' || url.endsWith('.mpd');
            
            // 根据类型创建或更新播放器
            if (isMPD) {
                art = createDashPlayer(url, options);
            } else {
                if (!art) {
                    art = createDefaultPlayer(url);
                } else {
                    // 清理现有实例的DASH相关资源
                    if (art.dash) {
                        try {
                            art.dash.destroy();
                            art.dash = null;
                        } catch (e) {
                            console.warn('[Player] 清除dash实例失败:', e);
                        }
                    }
                    
                    art.option.customType = {};
                    art.option.type = '';
            art.url = url;
                }
            }
            
            // 等待视频就绪
            await new Promise<void>((resolve) => {
                const loadedHandler = () => {
                    resolve();
                    art.off('video:loadeddata', loadedHandler);
                };
                art.on('video:loadeddata', loadedHandler);
            });
            
            // 设置额外选项
            if (options.headers && !isMPD) {
                art.headers = options.headers;
            }
            
            // 设置播放时间和循环
            if (options.startTime !== undefined) {
                if (options.isLoop && options.endTime !== undefined) {
                    setPlayTime(options.startTime, options.endTime);
                } else {
                    setPlayTime(options.startTime);
                }
            }

            // 开始播放
            art.play();
        } catch (error) {
            console.error("[Player] 播放失败:", error);
            showMessage("播放失败，请重试");
            
            // 触发错误事件，允许外部处理
            if (art?.container) {
                const event = new CustomEvent('streamError', {
                    detail: { url, options }
                });
                art.container.dispatchEvent(event);
            }
        }
    }
    
    // ===================== 外部接口：时间和控制 =====================
    
    /**
     * 设置播放时间和循环片段
     * @param start 开始时间（秒）
     * @param end 结束时间（秒），可选
     */
    export function setPlayTime(start: number, end?: number): void {
        if (!art) return;
        
        try {
            // 重置循环状态
            loopCount = 0;
            currentChapter = null;
            
            // 设置循环片段
            if (end !== undefined) {
                currentChapter = { start, end };
            }
            
            // 跳转到开始时间
            art.currentTime = start;
        } catch (error) {
            console.error('[Player] 设置播放时间失败:', error);
            showMessage('设置播放时间失败');
        }
    }
    
    /**
     * 设置循环播放
     * @param isLoop 是否循环
     * @param loopTimes 循环次数
     */
    export function setLoop(isLoop: boolean, loopTimes?: number): void {
        if (!art) return;
        
        try {
            art.loop = isLoop;
            
            if (loopTimes !== undefined && config) {
                config.loopCount = loopTimes;
            }
        } catch (error) {
            console.error('[Player] 设置循环播放失败:', error);
        }
    }
    
    /**
     * 更新播放器配置
     * @param newConfig 新配置
     */
    export function updateConfig(newConfig: any): void {
        if (!art) return;
        
        const safeConfig = { ...DEFAULT_CONFIG, ...newConfig };
        
        // 更新音量和播放速度
        art.volume = safeConfig.volume / 100;
        art.playbackRate = safeConfig.speed / 100;
    }
    
    /**
     * 跳转到指定时间
     * @param time 目标时间（秒）
     */
    export function seekTo(time: number): void {
        if (art) {
            art.currentTime = time;
        }
    }
    
    /**
     * 获取当前播放时间
     * @returns 当前时间（秒）
     */
    export function getCurrentTime(): number {
        return art?.currentTime || 0;
    }
    
    /**
     * 获取当前帧截图
     * @returns 截图的DataURL
     */
    export async function getScreenshotDataURL(): Promise<string | null> {
        if (!art) return null;
        return art.getDataURL();
    }
    
    // ===================== 生命周期 =====================
    
    onMount(() => {
        if (playerContainer) {
            createDefaultPlayer('');
        }
    });
    
    onDestroy(() => {
        destroyPlayer();
    });
</script>

<div class="artplayer-app" bind:this={playerContainer}>
    <!-- Artplayer 将在这里初始化 -->
</div>