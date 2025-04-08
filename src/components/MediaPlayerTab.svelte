<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Player from './Player.svelte';
    import PlayList from './PlayList.svelte';
    import Setting from './Setting.svelte';
    import ControlBar from './ControlBar.svelte';
    import type { ConfigManager } from '../core/config';
    import type { MediaItem } from '../core/types';
    import { BilibiliParser } from '../core/bilibili';
    import { LinkHandler } from '../core/LinkHandler';
    import { formatTime } from '../core/utils';

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
    let currentItem: MediaItem | null = null;
    let player: Player;
    let playerConfig: any;
    let loopStartTime: number | null = null;
    let playlist: PlayList;

    // =============== 工具函数 ===============
    const getCurrentBlockId = (): string => {
        const selection = window.getSelection();
        if (!selection?.focusNode) throw new Error(i18n.mediaPlayerTab.block.cursorNotFound);

        let element = selection.focusNode as HTMLElement;
        while (element && !element.dataset?.nodeId) {
            element = element.parentElement as HTMLElement;
        }

        if (!element?.dataset.nodeId) throw new Error(i18n.mediaPlayerTab.block.targetBlockNotFound);
        return element.dataset.nodeId;
    };

    const insertContent = async (content: string): Promise<void> => {
        try {
            const config = await configManager.getConfig();
            if (config.settings.insertAtCursor ?? true) {
                const blockId = getCurrentBlockId();
                const response = await fetch('/api/block/updateBlock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: content, dataType: "markdown", id: blockId })
                });
                if (!response.ok) throw new Error();
                showMessage(i18n.mediaPlayerTab.block.linkInserted);
            } else {
                await navigator.clipboard.writeText(content);
                showMessage(i18n.mediaPlayerTab.block.copiedToClipboard);
            }
        } catch {
            await navigator.clipboard.writeText(content);
            showMessage(i18n.mediaPlayerTab.block.insertFailed);
        }
    };

    const createTimestampLink = (isLoop = false, startTime?: number, endTime?: number): string | null => {
        if (!player || !currentItem) return null;

        try {
            const currentTime = startTime ?? player.getCurrentTime();
            const loopEndTime = endTime ?? (isLoop ? currentTime + 3 : undefined);
            const baseUrl = currentItem.originalUrl || currentItem.url;
            if (!baseUrl) throw new Error();

            const urlObj = new URL(baseUrl);
            urlObj.searchParams.delete('t');
            
            if (isLoop && loopEndTime) {
                urlObj.searchParams.set('t', `${currentTime.toFixed(1)}-${loopEndTime.toFixed(1)}`);
                return `- [${formatTime(currentTime, true)}-${formatTime(loopEndTime, true)}](${urlObj.toString()})`;
            }
            urlObj.searchParams.set('t', currentTime.toFixed(1));
            return `- [${formatTime(currentTime, true)}](${urlObj.toString()})`;
        } catch {
            showMessage(i18n.mediaPlayerTab.timestamp.generateFailed);
            return null;
        }
    };

    // =============== 媒体操作 ===============
    const takeScreenshot = async (): Promise<void> => {
        if (!player || !currentItem) {
            showMessage(i18n.controlBar.screenshot.hint);
            return;
        }

        try {
            const dataUrl = await player.getScreenshotDataURL();
            if (!dataUrl) {
                showMessage(i18n.mediaPlayerTab.screenshot.failHint);
                return;
            }
            
            const res = await fetch(dataUrl);
            const imageBlob = await res.blob();
            const timestamp = Date.now();
            const filename = `${currentItem.title || i18n.mediaPlayerTab.screenshot.defaultName}_${timestamp}.png`;
            
            const formData = new FormData();
            formData.append('file[]', imageBlob, filename);
            
            const response = await fetch('/api/asset/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error();
            
            const result = await response.json();
            if (result.code !== 0) throw new Error();
            
            await insertContent(`![${filename}](${result.data.succMap[filename]})`);
            showMessage(i18n.mediaPlayerTab.screenshot.successHint);
        } catch {
            showMessage(i18n.mediaPlayerTab.screenshot.errorHint);
        }
    };

    const createTimestamp = async (): Promise<void> => {
        if (!player || !currentItem) {
            showMessage(i18n.controlBar.screenshot.hint);
            return;
        }
        const link = createTimestampLink(false);
        if (link) await insertContent(link);
    };

    const createLoopSegment = async (): Promise<void> => {
        if (!player || !currentItem) {
            showMessage(i18n.controlBar.screenshot.hint);
            return;
        }
        
        const currentTime = player.getCurrentTime();
        if (loopStartTime === null) {
            loopStartTime = currentTime;
            showMessage(i18n.controlBar.loopSegment.startHint);
        } else {
            const link = createTimestampLink(true, loopStartTime, currentTime);
            if (link) await insertContent(link);
            loopStartTime = null;
        }
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
    };

    const handleSelect = (event: CustomEvent<MediaItem>) => {
        currentItem = event.detail;
    };

    const handleControlEvent = async (event: CustomEvent): Promise<void> => {
        const action = event.type.replace(':', '');
        switch (action) {
            case 'screenshot': await takeScreenshot(); break;
            case 'timestamp': await createTimestamp(); break;
            case 'loopSegment': await createLoopSegment(); break;
            case 'playlist': 
                showPlaylist = !showPlaylist;
                if (showPlaylist) showSettings = false;
                break;
            case 'settings': 
                showSettings = !showSettings;
                if (showSettings) showPlaylist = false;
                break;
        }
    };

    const handleStreamError = (event: CustomEvent): void => {
        if (event.detail.type === 'bilibili') handleBilibiliError();
    };

    const playMedia = async (event: CustomEvent): Promise<void> => {
        const options = event.detail;
        if (!options?.url) {
            showMessage(i18n.mediaPlayerTab.play.invalidOptions);
            return;
        }

        try {
            currentItem = {
                id: options.id || `item-${Date.now()}`,
                title: options.title || i18n.mediaPlayerTab.play.untitledMedia,
                url: options.url,
                originalUrl: options.originalUrl || options.url,
                type: ['bilibili-dash', 'bilibili'].includes(options.type) ? 'bilibili' : 'video',
                startTime: options.startTime,
                endTime: options.endTime,
                isLoop: options.isLoop,
                loopCount: options.loopCount,
                bvid: options.bvid,
                cid: options.cid
            };

            if (['bilibili-dash', 'bilibili'].includes(options.type)) {
                await player.play(options.url, {
                    type: options.type,
                    headers: options.headers,
                    title: options.title
                });
            } else {
                await player.play(options.url);
            }

            if (options.startTime !== undefined) {
                player.setPlayTime(options.startTime, options.endTime);
            }

            if (options.isLoop) {
                player.setLoop(true, options.loopCount);
            }
        } catch (error) {
            showMessage(i18n.mediaPlayerTab.play.failMessage + error.message);
        }
    };

    const handleBilibiliError = async (): Promise<void> => {
        if (currentItem?.type !== 'bilibili' || !currentItem.bvid || !currentItem.cid) return;
        
        try {
            const config = await configManager.getConfig();
            const streamInfo = await BilibiliParser.getProcessedVideoStream(
                currentItem.bvid,
                currentItem.cid,
                0,
                config
            );
            
            if (player) {
                const url = streamInfo.mpdUrl || streamInfo.video.url;
                const type = streamInfo.mpdUrl ? 'bilibili-dash' : 'bilibili';
                player.play(url, {
                    type,
                    headers: streamInfo.headers,
                    title: currentItem.title
                });
            }
        } catch {
            showMessage(i18n.mediaPlayerTab.stream.playbackError);
        }
    };

    // =============== 生命周期 ===============
    onMount(() => {
        const init = async () => {
            const config = await configManager.load();
            playerConfig = config.settings;
            if (!playerConfig.loopCount) playerConfig.loopCount = 3;

            const playerContainer = document.querySelector('.artplayer-app');
            if (playerContainer) {
                playerContainer.addEventListener('streamError', handleStreamError as EventListener);
            }
        };

        init();
        
        return () => {
            const playerContainer = document.querySelector('.artplayer-app');
            if (playerContainer) {
                playerContainer.removeEventListener('streamError', handleStreamError as EventListener);
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

<div 
    class="media-player-tab"
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
>
    <div class="content-area" class:with-sidebar={showPlaylist || showSettings}>
        <div class="player-area">
            <Player 
                bind:this={player}
                {app}
                config={playerConfig}
                {i18n}
            />
            
            <div class="control-bar" class:hidden={!showControls}>
                <ControlBar 
                    title={currentItem?.title}
                    {loopStartTime}
                    {i18n}
                    on:screenshot={handleControlEvent}
                    on:timestamp={handleControlEvent}
                    on:loopSegment={handleControlEvent}
                    on:playlist={handleControlEvent}
                    on:settings={handleControlEvent}
                />
            </div>
        </div>
        
        <div class="sidebar" class:show={showPlaylist || showSettings}>
            <PlayList 
                bind:this={playlist}
                {configManager}
                {currentItem}
                className="playlist-container"
                hidden={!showPlaylist}
                {i18n}
                on:select={handleSelect}
                on:play={playMedia}
            />
            {#if showSettings}
                <Setting 
                    group="media-player"
                    {configManager}
                    {i18n}
                    on:changed={handleSettingsChanged}
                />
            {/if}
        </div>
    </div>
</div> 