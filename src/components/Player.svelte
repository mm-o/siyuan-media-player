<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Artplayer from 'artplayer';
    import artplayerPluginChapter from 'artplayer-plugin-chapter';
    import type { MediaItem, PlayOptions } from '../types/media';
    
    // 组件属性
    export let app: any;
    export let config: any;
    
    // Artplayer 实例
    let art: any = null;
    //let chapterPlugin: any = null;  // 添加章节插件引用
    // 播放器容器 DOM 元素引用
    let playerContainer: HTMLElement;
    // 当前循环片段
    let currentChapter: { start: number; end: number; } | null = null;
    // 循环计数器
    let loopCount = 0;
    
    // ===================== 1. 初始化 Artplayer 播放器 =====================
    
    onMount(() => {
        if (!playerContainer) return;
        
        // 使用传入的配置或默认配置
        const defaultConfig = {
            volume: 70,
            speed: 100,
            hotkey: true,
            loop: false,
            loopCount: 3  // 默认循环次数
        };
        const initialConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
        
        // 初始化 Artplayer 播放器
        art = new Artplayer({
            container: playerContainer,
            url: '',
            volume: initialConfig.volume / 100,
            isLive: false,
            muted: false,
            autoplay: true,
            pip: true,
            autoSize: true,
            autoMini: true,
            setting: true,
            loop: initialConfig.loop,
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
            crossOrigin: 'anonymous',
        });
        
        // 添加时间更新监听器
        art.on('video:timeupdate', () => {
            // 检查是否需要循环
            if (currentChapter && art.currentTime >= currentChapter.end) {
                // 从配置获取最大循环次数
                const maxLoopCount = config.loopCount || 3;
                
                if (maxLoopCount > 0 && loopCount >= maxLoopCount) {
                    // 达到循环次数限制，清除循环
                    currentChapter = null;
                    loopCount = 0;
                    // 使用 notice 显示循环结束提示
                    art.notice.show = '循环播放结束';
                    return;
                }
                
                // 跳转到开始位置
                art.currentTime = currentChapter.start;
                // 同步音频时间
                if (audioPlugin.audio) {
                    audioPlugin.audio.currentTime = currentChapter.start;
                }
                loopCount++;
                // 使用 notice 显示当前循环次数
                art.notice.show = `第 ${loopCount}/${maxLoopCount} 次循环`;
            }
        });
        
        // 确保播放器完全初始化
        art.on('ready', () => {
            console.log("[Player] Artplayer 就绪");
            if (initialConfig) {
                updateConfig(initialConfig);
            }
        });
    });
    // 组件销毁时清理
    onDestroy(() => {
        if (art) {
            audioPlugin.destroy();
            art.destroy(true);
            art = null;
        }
    });
    
    // ===================== 2. 音视频插件 =====================
    
    const audioPlugin = {
        // B站音频元素
        audio: null as HTMLAudioElement | null,

        // 创建音频元素
        createAudio: async (url: string, headers?: any) => {
            audioPlugin.destroy();
            
            const audio = new Audio();
            audio.preload = 'auto';
            
            // 添加请求头参数
            if (headers) {
                        const audioUrl = new URL(url);
                if (headers.Referer) {
                            audioUrl.searchParams.set('referer', headers.Referer);
                        }
                if (headers.Cookie) {
                            audioUrl.searchParams.set('cookie', headers.Cookie);
                }
                audio.src = audioUrl.toString();
            } else {
                audio.src = url;
            }
            
            await new Promise<void>((resolve) => {
                audio.addEventListener('canplaythrough', () => {
                    resolve();
                });
            });
            
            audioPlugin.audio = audio;
        },

        // 同步音频状态
        syncState: () => {
            if (!audioPlugin.audio || !art) return;
            
            audioPlugin.audio.currentTime = art.currentTime;
            if (art.playing) {
                audioPlugin.audio.play().catch(console.error);
            } else {
                audioPlugin.audio.pause();
            }
            audioPlugin.audio.playbackRate = art.playbackRate;
            audioPlugin.audio.volume = art.volume;
            audioPlugin.audio.muted = art.muted;
        },

        // 注册事件监听
        registerEvents: () => {
            if (!art) return;
            
            art.on('play', () => audioPlugin.syncState());
            art.on('pause', () => audioPlugin.audio?.pause());
            art.on('seek', () => {
                if (audioPlugin.audio) audioPlugin.audio.currentTime = art.currentTime;
            });
            art.on('video:ratechange', () => {
                if (audioPlugin.audio) audioPlugin.audio.playbackRate = art.playbackRate;
            });
            art.on('video:volumechange', () => {
                if (audioPlugin.audio) {
                    audioPlugin.audio.volume = art.volume;
                    audioPlugin.audio.muted = art.muted;
                }
            });
        },
        
        // 销毁音频
        destroy: () => {
            if (audioPlugin.audio) {
                audioPlugin.audio.pause();
                audioPlugin.audio.remove();
                audioPlugin.audio = null;
            }
        }
    };
    
    // ===================== 3. 统一的时间控制插件 =====================
    
    /**
     * 设置播放时间和循环
     */
    function setPlayTime(start: number, end?: number) {
        if (!art) return;
        
        try {
            // 重置循环状态
            loopCount = 0;
            currentChapter = null;
            
            // 如果有结束时间，设置循环片段
            if (end !== undefined) {
                currentChapter = { start, end };
            }
            
            // 跳转到开始时间
            art.currentTime = start;
            
            // 同步音频时间
            if (audioPlugin.audio) {
                audioPlugin.audio.currentTime = start;
            }
        } catch (error) {
            console.error('[Player] 设置播放时间失败:', error);
            showMessage('设置播放时间失败');
        }
    }

    // 播放媒体
    export async function play(url: string, options: PlayOptions = {}) {
        try {
            // 重置循环状态
            currentChapter = null;
            loopCount = 0;
            
            // 清理之前的音频
            audioPlugin.destroy();
            
            // 设置播放源
            art.url = url;
            
            // 等待视频就绪
            await new Promise<void>((resolve) => {
                const loadedHandler = () => {
                    resolve();
                    art.off('video:loadeddata', loadedHandler);
                };
                art.on('video:loadeddata', loadedHandler);
            });
            
            // 如果有音频轨道，设置音频源
            if (options.audioUrl) {
                await audioPlugin.createAudio(options.audioUrl, options.headers);
                audioPlugin.registerEvents();
            }
            
            // 如果有自定义请求头，设置请求头
            if (options.headers) {
                art.headers = options.headers;
            }
            
            // 设置播放时间和循环
            if (options.startTime !== undefined) {
                if (options.isLoop && options.endTime !== undefined) {
                    // 循环片段模式
                    setPlayTime(options.startTime, options.endTime);
                } else {
                    // 时间戳模式
                    setPlayTime(options.startTime);
                }
            }

            // 开始播放
            art.play();
            
            // 统一的播放状态日志
            console.log("[Player] 开始播放:", {
                url,
                options: {
                    time: options.startTime,
                    loop: options.isLoop ? {
                        start: options.startTime,
                        end: options.endTime,
                        maxCount: config.loopCount
                    } : null,
                    audio: !!options.audioUrl
                }
            });
            
        } catch (error) {
            console.error("[Player] 播放失败:", error);
            showMessage("播放失败，请重试");
            
            // 清理音频
            audioPlugin.destroy();
            
            if (art?.container) {
                const event = new CustomEvent('streamError', {
                    detail: { url, options }
                });
                art.container.dispatchEvent(event);
            }
        }
    }
    
    // 更新配置
    export function updateConfig(newConfig: any) {
        if (!art) return;
        
            art.volume = newConfig.volume / 100;
            art.playbackRate = newConfig.speed / 100;
            art.loop = newConfig.loop;
            
            if (newConfig.autoplay && art.url) {
                art.play();
        }
    }
    
    // 获取截图
    export async function getScreenshotDataURL(): Promise<string | null> {
        if (!art) return null;
        return art.getDataURL();
    }
    
    // 导出 seek 相关方法
    export function seekTo(time: number) {
        if (art) {
            art.currentTime = time;
        }
    }
    export function getCurrentTime(): number {
        return art?.currentTime || 0;
    }
</script>

<div class="artplayer-app" bind:this={playerContainer}>
    <!-- Artplayer 将在这里初始化 -->
</div>