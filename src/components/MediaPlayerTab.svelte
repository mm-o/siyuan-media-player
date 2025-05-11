<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Player from './Player.svelte';
    import PlayList from './PlayList.svelte';
    import Setting from './Setting.svelte';
    import ControlBar from './ControlBar.svelte';
    import Assistant from './Assistant.svelte';
    import type { ConfigManager } from '../core/config';
    import type { MediaItem } from '../core/types';
    import { LinkHandler } from '../core/LinkHandler';
    import { link, player as playerUtils, doc, mediaNotes } from '../core/utils';
    import { 
        registerGlobalPlayer, 
        handleMediaError,
        playMedia as playMediaContent
    } from '../core/media';
    import { showMessage } from 'siyuan';

    // =============== 组件属性 ===============
    export let app: any;
    export let configManager: ConfigManager;
    export let linkHandler: LinkHandler;
    
    // =============== 组件状态 ===============
    let i18n = app.i18n;
    let showControls = true;
    let controlTimer: number;
    let showPlaylist = false;
    let showSettings = false;
    let showAssistant = false;
    let currentItem: MediaItem | null = null;
    let player: Player;
    let playerConfig: any;
    let loopStartTime: number | null = null;
    let playlist: PlayList;
    let proEnabled: boolean = false;
    let sidebarWidth = +(localStorage.getItem('simp-width') || 300);

    // 监听player变化，同步到全局对象
    $: if (player && currentItem) {
        registerGlobalPlayer(currentItem, player);
    }

    // 监听currentItem变化，同步到全局对象
    $: if (typeof window !== 'undefined' && (window as any).siyuanMediaPlayer) {
        (window as any).siyuanMediaPlayer.currentItem = currentItem;
    }

    // 极简拖动逻辑
    const initResize = (e: MouseEvent) => {
        const startX = e.clientX, startWidth = sidebarWidth;
        const onMove = (e: MouseEvent) => {
            sidebarWidth = Math.max(200, Math.min(600, startWidth + startX - e.clientX));
            localStorage.setItem('simp-width', String(sidebarWidth));
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onMove);
        }, {once: true});
    };

    // 创建时间戳链接函数，供其他组件使用
    export const createTimestampLink = async (isLoop = false, startTime?: number, endTime?: number, subtitleText?: string): Promise<string | null> => {
        if (!player || !currentItem) return null;
        
        const config = await configManager.getConfig();
        const currentTime = startTime ?? player.getCurrentTime();
        const loopEndTime = endTime ?? (isLoop ? currentTime + 3 : undefined);
        
        return link(
            currentItem, 
            config, 
            currentTime, 
            loopEndTime, 
            subtitleText
        );
    };

    // =============== 事件处理 ===============
    const handleMouseMove = () => {
        showControls = true;
        clearTimeout(controlTimer);
        controlTimer = window.setTimeout(() => showControls = false, 3000);
    };

    const handleMouseLeave = () => {
        clearTimeout(controlTimer);
        showControls = false;
    };

    const handleSettingsChanged = (event: CustomEvent) => {
        playerConfig = event.detail.settings;
        player?.updateConfig(playerConfig);
        
        // 检查Pro状态是否变更
        if (event.detail.proEnabled !== undefined) {
            proEnabled = event.detail.proEnabled;
        }
    };

    const handleSelect = (event: CustomEvent<MediaItem>) => {
        currentItem = event.detail;
    };

    const handleControlEvent = async (event: CustomEvent): Promise<void> => {
        const action = event.type.replace(':', '');
        const config = await configManager.getConfig();
        
        switch (action) {
            case 'screenshot': 
                await playerUtils.screenshot(player, currentItem, config, i18n); 
                break;
            case 'timestamp': 
                await playerUtils.timestamp(player, currentItem, config, i18n); 
                break;
            case 'loopSegment': 
                loopStartTime = await playerUtils.loop(player, currentItem, config, i18n, loopStartTime); 
                break;
            case 'mediaNotes':
                // 媒体笔记功能实现
                if (!currentItem) {
                    showMessage(i18n.controlBar.mediaNotes?.hint || "请先播放媒体");
                    return;
                }
                await mediaNotes.create(currentItem, config, player, i18n);
                break;
            case 'playlist': 
                showPlaylist = !showPlaylist;
                if (showPlaylist) {
                    showSettings = false;
                    showAssistant = false;
                }
                break;
            case 'settings': 
                showSettings = !showSettings;
                if (showSettings) {
                    showPlaylist = false;
                    showAssistant = false;
                }
                break;
            case 'assistant':
                showAssistant = !showAssistant;
                if (showAssistant) {
                    showPlaylist = false;
                    showSettings = false;
                }
                break;
        }
    };

    // 处理媒体错误
    const handleMediaErrors = (event: CustomEvent): Promise<void> => 
        handleMediaError(event, currentItem, player, configManager, i18n);

    // 播放媒体函数
    const playMedia = (event: CustomEvent): Promise<void> => 
        playMediaContent(event.detail, player, configManager, (item) => currentItem = item, i18n);

    // =============== 生命周期 ===============
    onMount(() => {
        const init = async () => {
            // 初始化配置
            const config = await configManager.load();
            playerConfig = config.settings;
            playerConfig.loopCount ??= 3;
            
            // 加载Pro状态
            proEnabled = config.proEnabled || false;

            // 检查B站登录状态
            if (config.bilibiliLogin?.userInfo?.mid) {
                window.dispatchEvent(new CustomEvent('biliLoginStatusChange', { 
                    detail: { isLoggedIn: true, userInfo: config.bilibiliLogin.userInfo } 
                }));
            }
            
            // 监听媒体错误
            document.querySelector('.artplayer-app')?.addEventListener('mediaError', handleMediaErrors as EventListener);
            
            // 监听直接播放事件（AList媒体直接播放模式）
            window.addEventListener('directMediaPlay', (e: CustomEvent) => playMedia(e));
            
            // 注册全局播放器对象
            registerGlobalPlayer(currentItem, player);
        };

        init();
        
        return () => {
            // 清理事件监听
            document.querySelector('.artplayer-app')?.removeEventListener('mediaError', handleMediaErrors as EventListener);
            window.removeEventListener('directMediaPlay', (e: CustomEvent) => playMedia(e));
            // 清理全局对象
            if (typeof window !== 'undefined') {
                (window as any).siyuanMediaPlayer = undefined;
            }
        };
    });

    onDestroy(() => {
        linkHandler?.setPlaylist(null);
    });

    $: if (playlist && linkHandler) {
        linkHandler.setPlaylist(playlist);
    }
</script>

<div class="media-player-tab" on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave}>
    <div class="content-area" class:with-sidebar={showPlaylist || showSettings || showAssistant}>
        <div class="player-area">
            <Player bind:this={player} config={playerConfig} {i18n} />
            <div class="control-bar" class:hidden={!showControls}>
                <ControlBar 
                    title={currentItem?.title} {loopStartTime} {i18n} {proEnabled}
                    on:screenshot={handleControlEvent}
                    on:timestamp={handleControlEvent}
                    on:loopSegment={handleControlEvent}
                    on:mediaNotes={handleControlEvent}
                    on:playlist={handleControlEvent}
                    on:settings={handleControlEvent}
                    on:assistant={handleControlEvent}
                />
            </div>
        </div>
        
        <div class="sidebar" class:show={showPlaylist || showSettings || showAssistant} 
             style="width:{sidebarWidth*(+(showPlaylist || showSettings || showAssistant))}px">
            <div class="resize-handle" on:mousedown={initResize}></div>
            <PlayList 
                bind:this={playlist} {configManager} {currentItem} {i18n}
                className="playlist-container" hidden={!showPlaylist}
                on:select={handleSelect} on:play={playMedia}
            />
            {#if showSettings}
                <Setting group="media-player" {configManager} {i18n} on:changed={handleSettingsChanged} />
            {/if}
            {#if showAssistant}
                <Assistant 
                    {configManager} {player} {i18n} currentMedia={currentItem}
                    className="assistant-container" hidden={!showAssistant}
                    insertContentCallback={(content) => doc.insert(content, configManager.getConfig(), i18n)} 
                    createTimestampLinkCallback={createTimestampLink}
                />
            {/if}
        </div>
    </div>
</div>