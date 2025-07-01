<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Artplayer from 'artplayer';
    import * as dashjs from 'dashjs';
    import type { PlayOptions, MediaItem } from '../core/types';
    import { SubtitleManager } from '../core/subtitle';
    import { DanmakuManager } from '../core/danmaku';
    import { createBiliMPD } from '../core/bilibili';
    
    // ===== 属性和状态 =====
    export let config: any = {};
    export let i18n: any = {};
    export let currentItem: MediaItem = null;
    export let api: any = {};
    
    // 内部状态
    let art: any = null;
    let playerContainer: HTMLDivElement;
    let currentChapter: { start: number; end: number; } | null = null;
    let loopCount = 0;
    let currentSubtitle = '';
    let subtitleVisible = false;
    let subtitleTimer: number;
    let loopStartTime: number | null = null;
    
    // 默认配置
    const DEFAULT_CONFIG = { volume: 70, speed: 100, loopCount: 3 };
    
    // ===== 核心功能：播放器 =====
    function initPlayer(url = '', options = {}): any {
        cleanup();
        
        const safeConfig = { ...DEFAULT_CONFIG, ...config };
        const player = new Artplayer({
            container: playerContainer,
            url,
            volume: safeConfig.volume / 100,
            autoplay: true,
            muted: true,
            pip: false,
            autoSize: true,
            setting: true,
            flip: true,
            playbackRate: true,
            aspectRatio: true,
            subtitleOffset: true,
            fullscreen: false,
            fullscreenWeb: false,
            miniProgressBar: true,
            mutex: true,
            playsInline: true,
            loop: !!safeConfig.loopSingle,
            theme: 'var(--b3-theme-primary)',
            lang: window.siyuan?.config?.lang?.toLowerCase() === 'en_us' ? 'en' : 'zh-cn',
            controls: [
                {
                    name: 'screenshot',
                    position: 'right',
                    index: 10,
                    html: '<svg viewBox="0 0 1024 1024" width="22" height="22"><path fill="currentColor" d="M853.333333 170.666667a73.142857 73.142857 0 0 1 73.142857 73.142857v536.380952a73.142857 73.142857 0 0 1-73.142857 73.142857H170.666667a73.142857 73.142857 0 0 1-73.142857-73.142857V243.809524a73.142857 73.142857 0 0 1 73.142857-73.142857h682.666666z m0 73.142857H170.666667v536.380952h682.666666V243.809524z m-375.856762 168.057905l120.685715 120.685714 51.687619-51.712 172.422095 172.373333-51.712 51.736381-120.685714-120.685714-51.736381 51.736381-120.685715-120.685714-224.109714 224.109714-51.712-51.687619 275.846095-275.870476zM731.428571 292.571429a48.761905 48.761905 0 1 1 0 97.523809 48.761905 48.761905 0 0 1 0-97.523809z"/></svg>',
                    tooltip: i18n.controlBar?.screenshot?.name || '截图',
                    click: () => triggerAction('screenshot')
                },
                {
                    name: 'timestamp',
                    position: 'right',
                    index: 11,
                    html: '<svg viewBox="0 0 1024 1024" width="22" height="22"><path fill="currentColor" d="M511.292952 121.904762c80.408381 0 155.087238 24.405333 217.136762 66.218667l-49.737143 49.785904a318.756571 318.756571 0 0 0-167.399619-47.152762C334.189714 190.756571 190.610286 334.57981 190.610286 512s143.60381 321.243429 320.682666 321.243429c177.103238 0 320.682667-143.823238 320.682667-321.243429 0-49.127619-11.02019-95.695238-30.72-137.337905l51.102476-51.078095A388.87619 388.87619 0 0 1 900.681143 512c0 215.454476-174.32381 390.095238-389.36381 390.095238C296.228571 902.095238 121.904762 727.454476 121.904762 512S296.228571 121.904762 511.292952 121.904762z m0 137.679238c42.179048 0 81.968762 10.386286 116.906667 28.769524l-51.955809 51.931428a182.54019 182.54019 0 0 0-64.950858-11.849142c-101.180952 0-183.247238 82.16381-183.247238 183.56419 0 101.376 82.041905 183.588571 183.247238 183.588571s183.247238-82.212571 183.247238-183.588571a185.295238 185.295238 0 0 0-2.194285-28.42819l56.344381-56.32c9.435429 26.477714 14.57981 55.003429 14.579809 84.74819 0 139.410286-112.810667 252.416-251.977143 252.416-139.142095 0-251.952762-113.005714-251.952762-252.416s112.810667-252.416 251.952762-252.416zM853.577143 143.433143L902.095238 192.146286 566.613333 527.676952l-51.102476 2.681905 2.535619-51.297524 335.481905-335.62819z"/></svg>',
                    tooltip: i18n.controlBar?.timestamp?.name || '添加时间戳',
                    click: () => triggerAction('timestamp')
                },
                {
                    name: 'loopSegment',
                    position: 'right',
                    index: 12,
                    html: `<svg viewBox="0 0 1024 1024" width="22" height="22">
                        <path fill="currentColor" d="M1020.562286 846.555429q0 43.885714-43.885715 43.885714h-50.029714v85.284571q0 18.212571-12.873143 31.085715t-31.012571 12.873142q-43.885714 0-43.885714-43.885714v-85.357714H140.726857q-43.885714 0-43.885714-43.885714V215.04H45.348571q-43.885714 0-43.885714-43.885715t43.885714-43.885715h51.565715V48.493714q0-43.885714 43.885714-43.885714t43.885714 43.885714V127.268571h698.148572q18.139429 0 31.012571 12.873143 12.8 12.873143 12.8 31.012572v631.588571h50.102857q43.885714 0 43.885715 43.812572z m-181.686857-43.885715V215.04H184.612571v587.702857h654.262858z"/>
                        <path fill="currentColor" d="M608.256 321.609143q-41.106286-17.773714-86.308571-17.773714-45.129143 0-86.162286 17.627428-35.401143 15.213714-63.341714 41.618286v-9.947429q0-14.043429-10.020572-23.990857-9.874286-9.801143-23.771428-9.801143t-23.844572 10.020572q-10.020571 9.947429-10.020571 23.771428V470.308571q0 14.116571 10.020571 24.064 9.947429 9.801143 23.844572 9.801143h117.174857q14.043429 0 23.990857-10.020571 9.801143-9.947429 9.801143-23.844572 0-13.824-10.020572-23.844571-9.947429-9.947429-23.771428-9.947429h-43.885715q19.602286-25.746286 48.859429-40.228571 33.645714-16.603429 71.460571-13.750857 50.980571 3.876571 87.478858 40.521143 36.571429 36.571429 40.082285 87.478857 4.242286 60.416-37.010285 104.448-40.96 43.885714-100.937143 43.885714-43.739429 0-79.36-25.161143-34.742857-24.576-49.883429-64.365714-4.388571-11.702857-14.409143-18.797714-10.093714-7.094857-22.308571-7.094857-20.187429 0-32.182857 16.530285-11.922286 16.676571-4.973715 35.401143 24.137143 65.097143 81.334858 104.155429 58.733714 40.155429 130.413714 37.156571 84.260571-33.364571 144.457143-63.561143 60.196571-60.050286 63.634285-144.091428 1.828571-45.494857-14.482285-87.332572-15.725714-40.374857-45.933715-71.68-30.208-31.232-69.924571-48.420571z"/>
                    </svg>`,
                    tooltip: i18n.controlBar?.loopSegment?.name || '循环片段',
                    click: () => triggerAction('loopSegment')
                },
                {
                    name: 'mediaNotes',
                    position: 'right',
                    index: 13,
                    html: '<svg viewBox="0 0 1024 1024" width="22" height="22"><path fill="currentColor" d="M832 128a64 64 0 0 1 64 64v640a64 64 0 0 1-64 64H192a64 64 0 0 1-64-64V192a64 64 0 0 1 64-64h640z m0 64H192v640h640V192zM320 384h384a32 32 0 0 1 0 64H320a32 32 0 0 1 0-64z m0 192h384a32 32 0 0 1 0 64H320a32 32 0 0 1 0-64z"/></svg>',
                    tooltip: i18n.controlBar?.mediaNotes?.name || '媒体笔记',
                    click: () => triggerAction('mediaNotes')
                }
            ],
            settings: [
                // 字幕开关
                {
                    html: i18n.player?.settings?.subtitleControlTip || '字幕开关',
                    switch: safeConfig.showSubtitles !== undefined ? safeConfig.showSubtitles : true,
                    onSwitch: item => {
                        subtitleVisible = !item.switch;
                        if (config) config.showSubtitles = subtitleVisible;
                        player.notice.show = subtitleVisible ? 
                            (i18n.player?.subtitle?.enabled || '已启用字幕') : 
                            (i18n.player?.subtitle?.disabled || '已禁用字幕');
                        return subtitleVisible;
                    }
                },
                // 画中画
                {
                    html: i18n.player?.settings?.pipMode || '画中画',
                    switch: false,
                    onSwitch: item => {
                        try {
                            const nextState = !item.switch;
                            if (nextState || document.pictureInPictureElement) player.pip = nextState;
                            return nextState;
                        } catch (e) { return item.switch; }
                    }
                },
                // 网页全屏
                {
                    html: i18n.player?.settings?.fullscreenWeb || '网页全屏',
                    switch: false,
                    onSwitch: item => { player.fullscreenWeb = !item.switch; return !item.switch; }
                },
                // 全屏
                {
                    html: i18n.player?.settings?.fullscreen || '全屏',
                    switch: false,
                    onSwitch: item => { player.fullscreen = !item.switch; return !item.switch; }
                }
            ],
            ...options
        });
        
        // 事件监听
        setupPlayerEvents(player, safeConfig);
        
        return player;
    }

    // ===== 播放器事件 =====
    function setupPlayerEvents(player, safeConfig) {
        // 循环播放处理
        player.on('video:timeupdate', () => {
            if (!currentChapter) return;
            
            if (player.currentTime >= currentChapter.end) {
                const maxLoopCount = safeConfig.loopCount;
                
                if (maxLoopCount > 0 && loopCount >= maxLoopCount) {
                    currentChapter = null;
                    loopCount = 0;
                    player.notice.show = i18n.player?.loop?.endMessage || '循环播放结束';
                    if (safeConfig.pauseAfterLoop) player.pause();
                    return;
                }
                
                player.currentTime = currentChapter.start;
                player.notice.show = (i18n.player?.loop?.currentLoop || '循环播放: ${current}/${total}')
                    .replace('${current}', ++loopCount)
                    .replace('${total}', maxLoopCount);
            }
        });
        
        // 初始化配置
        player.on('ready', () => {
            player.volume = safeConfig.volume / 100;
            player.playbackRate = safeConfig.speed / 100;
            subtitleVisible = safeConfig.showSubtitles !== undefined ? safeConfig.showSubtitles : true;
            startSubtitleTracking(player);
            
            // 显示就绪提示
            if (currentItem?.title) {
                player.notice.show = `${currentItem.title} ${i18n.player?.ready || "准备就绪"}`;
            }
            
            player.play().then(() => player.muted = false).catch(() => {});
        });
        
        // 错误处理
        player.on('error', (error) => {
            console.error("[Player] 播放错误", error);
            playerContainer?.dispatchEvent(new CustomEvent('mediaError', { detail: { error } }));
        });
        
        // 视频结束事件处理
        player.on('video:ended', () => {
            if (!safeConfig.loopSingle && safeConfig.loopPlaylist) {
                window.dispatchEvent(new CustomEvent('mediaEnded', { 
                    detail: { loopPlaylist: true }
                }));
            }
        });
    }
    
    // ===== 功能按钮操作 =====
    function triggerAction(action: 'screenshot' | 'timestamp' | 'mediaNotes' | 'loopSegment') {
        if (!art || art.isDestroyed) {
            art.notice.show = i18n.controlBar?.[action]?.hint || `请先播放媒体`;
            return;
        }
        
        // 循环片段特殊处理
        if (action === 'loopSegment') {
            if (loopStartTime === null) {
                loopStartTime = art.currentTime;
                art.notice.show = i18n.controlBar?.loopSegment?.startHint || "已记录开始时间";
                return;
            } 
            
            const endTime = art.currentTime;
            if (endTime <= loopStartTime) {
                art.notice.show = i18n.controlBar?.loopSegment?.errorHint || "结束时间必须大于开始时间";
                loopStartTime = null;
                return;
            }
        }
        
        // 发送事件并显示提示
        window.dispatchEvent(new CustomEvent('mediaPlayerAction', { 
            detail: { action, ...(action === 'loopSegment' && { loopStartTime }) } 
        }));
        
        art.notice.show = i18n.controlBar?.[action]?.desc || i18n.controlBar?.[action]?.name || action;
        if (action === 'loopSegment') loopStartTime = null;
    }
    
    // ===== 媒体处理 =====
    // DASH播放支持
    function playMpd(video: HTMLVideoElement, url: string, art: any) {
        if (!dashjs.supportsMediaSource()) {
            art.notice.show = '当前环境不支持播放B站视频';
            return;
        }
        
        if (art.dash) art.dash.destroy();
        
        try {
            const dash = dashjs.MediaPlayer().create();
            dash.initialize(video, url, art.option.autoplay);
            art.dash = dash;
            
            art.on('destroy', () => {
                if (art.dash) {
                    art.dash.destroy();
                    art.dash = null;
                }
            });
        } catch (error) {
            console.error("[Player] DASH初始化失败:", error);
            art.notice.show = 'DASH播放器初始化失败';
        }
    }
    
    // 字幕处理
    function startSubtitleTracking(player: any): void {
        if (subtitleTimer) clearInterval(subtitleTimer);
        
        subtitleTimer = window.setInterval(() => {
            if (!player) return;
            
            const subtitles = SubtitleManager.getSubtitles();
            if (!subtitles.length || !subtitleVisible) {
                currentSubtitle = '';
                return;
            }
            
            const time = player.currentTime;
            currentSubtitle = subtitles.find(
                cue => time >= cue.startTime && time <= cue.endTime
            )?.text || '';
        }, 200);
    }
    
    // 循环片段响应
    const handleLoopResponse = (e: any) => {
        if (!e.detail || art?.isDestroyed) return;
        loopStartTime = e.detail.loopStartTime;
        if (art) {
            art.notice.show = loopStartTime === null 
                ? (i18n.controlBar?.loopSegment?.resetHint || "已重置")
                : (i18n.controlBar?.loopSegment?.startHint || "已记录开始时间");
        }
    };
    
    // ===== 播放控制 =====
    // 播放媒体
    async function play(url: string, options: PlayOptions = {}): Promise<void> {
        try {
            currentChapter = null;
            loopCount = 0;

            // 更新当前项目和标题
            currentItem = options;
            window.dispatchEvent(new CustomEvent('siyuanMediaPlayerUpdate', {
                detail: { currentItem: options }
            }));
            
            let playerConfig: any = {};
            let actualUrl = url;
            
            // 处理特殊媒体源
            if (options.biliDash) {
                const mpdUrl = createBiliMPD(options.biliDash);
                if (mpdUrl) {
                    actualUrl = mpdUrl;
                    playerConfig.type = 'mpd';
                    playerConfig.customType = { mpd: playMpd };
                    playerConfig.headers = options.headers;
                }
            }
            
            // 加载弹幕
            if (config?.enableDanmaku) {
                try {
                    const danmakuUrl = options.cid 
                        ? await DanmakuManager.loadBiliDanmakuUrl(options.cid, config)
                        : await loadLocalDanmaku(url);
                    
                    if (danmakuUrl) {
                        playerConfig.plugins = [DanmakuManager.createDanmakuPlugin(danmakuUrl)];
                    }
                } catch (e) {}
            }
            
            // 初始化播放器
            art = initPlayer(actualUrl, playerConfig);
            await new Promise(resolve => {
                art.on('ready', () => resolve(null));
                if (art.isReady) resolve(null);
            });
            
            // 设置播放位置和循环
            if (options.startTime !== undefined) {
                if (options.endTime !== undefined) {
                    setPlayTime(options.startTime, options.endTime);
                } else {
                    art.currentTime = options.startTime;
                    art.notice.show = `${i18n.player?.jumpTo || "跳转至"} ${options.startTime.toFixed(1)}s`;
                }
            }
            
            art.play().catch(() => {});
        } catch (error) {
            console.error("[Player] 播放失败", error);
            if (art) art.notice.show = i18n.player?.error?.playRetry || "播放失败，请重试";
            playerContainer?.dispatchEvent(new CustomEvent('mediaError', {
                detail: { url, options, error }
            }));
        }
    }
    
    // 加载本地弹幕
    async function loadLocalDanmaku(url: string): Promise<string | null> {
        const opts = await DanmakuManager.getDanmakuFileForMedia(url);
        if (!opts) return null;
        
        const list = await DanmakuManager.loadDanmaku(opts.url, opts.type);
        return list?.length ? DanmakuManager.generateDanmakuUrl(list) : null;
    }
    
    // 设置播放时间和循环
    function setPlayTime(start: number, end?: number): void {
        if (!art) return;
        
        try {
            loopCount = 0;
            currentChapter = end !== undefined ? { start, end } : null;
            art.currentTime = start;
            art.play();
            
            if (currentChapter) {
                const duration = end - start;
                art.notice.show = (i18n.player?.loop?.setMessage || '设置循环片段: ${start}s - ${end}s (${duration}s)')
                    .replace('${start}', start.toFixed(1))
                    .replace('${end}', end.toFixed(1))
                    .replace('${duration}', duration.toFixed(1));
            }
        } catch (error) {
            console.error('设置播放时间失败', error);
            art.notice.show = i18n.player?.error?.setTimeFailed || "设置时间失败";
        }
    }
    
    // ===== 资源管理 =====
    // 资源清理
    function cleanup(): void {
        if (subtitleTimer) {
            clearInterval(subtitleTimer);
            subtitleTimer = null;
        }
        
        if (art) {
            try {
                art.pause();
                if (art.dash) art.dash.destroy();
                art.destroy(true);
            } catch (e) {
                console.error('清理播放器资源失败:', e);
            } finally {
                art = null;
            }
        }
        
        window.removeEventListener('loopSegmentResponse', handleLoopResponse);
        currentSubtitle = '';
        loopStartTime = null;
        loopCount = 0;
        currentChapter = null;
    }
    
    // 配置更新
    function updateConfig(newConfig: any): void {
        if (!art) return;
        
        Object.assign(config, newConfig);
        
        // 应用新配置
        art.volume = (config.volume || DEFAULT_CONFIG.volume) / 100;
        art.playbackRate = (config.speed || DEFAULT_CONFIG.speed) / 100;
        art.loop = !!config.loopSingle;
        subtitleVisible = config.showSubtitles !== undefined ? config.showSubtitles : true;
    }
    
    // ===== API 方法 =====
    const playerAPI = {
        getCurrentTime: () => art?.currentTime || 0,
        seekTo: (time: number) => art && (art.currentTime = time),
        pause: () => art && art.pause(),
        resume: () => art && art.play(),
        getScreenshotDataURL: () => art ? Promise.resolve(art.getDataURL()) : Promise.resolve(null),
        getCurrentMedia: () => currentItem,
        setLoop: (isLoop, loopTimes) => {
            if (art) {
                art.loop = isLoop;
                if (loopTimes !== undefined) config.loopCount = loopTimes;
            }
        },
        setPlayTime,
        setLoopSegment: setPlayTime, // 保留兼容性
        updateConfig,
        play,
        triggerAction
    };
    
    // ===== 初始化 =====
    function init() {
        // 初始化播放器
        if (playerContainer) {
            try { 
                art = initPlayer(); 
            } catch (error) { 
                console.error('初始化播放器失败', error); 
            }
        }
        
        // 事件监听
        window.addEventListener('loopSegmentResponse', handleLoopResponse);
        
        // 导出API
        Object.assign(api, playerAPI);
    }
    
    // 生命周期
    onMount(init);
    onDestroy(cleanup);
</script>

<div class="artplayer-app" bind:this={playerContainer} style="width:100%; height:100%; position:relative; z-index:2;">
    {#if currentSubtitle && subtitleVisible}
        <div style="position:absolute; bottom:100px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); color:white; padding:5px 10px; border-radius:4px; max-width:80%; text-align:center; z-index:10;">{currentSubtitle}</div>
    {/if}
</div>