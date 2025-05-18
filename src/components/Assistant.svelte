<script lang="ts">
    import { SubtitleManager } from '../core/subtitle';
    import { DanmakuManager } from '../core/danmaku';
    import { BilibiliParser } from '../core/bilibili';
    import { onDestroy, onMount } from 'svelte';
    import { showMessage } from 'siyuan';

    // 组件属性
    export let configManager, className = '', hidden = false, i18n: any = {}, currentMedia: any = null, player: any = null;
    export let insertContentCallback, createTimestampLinkCallback;
    export let allTabs = [];
    export let activeTabId = 'assistant';

    // 组件状态
    let activeTab = 'subtitles';
    let subtitles = [], summaryItems = [], danmakus = [], currentSubtitleIndex = -1;
    let isLoadingSubtitles = false, isLoadingSummary = false, isLoadingDanmakus = false;
    let timer = null;
    let autoScrollEnabled = true;
    let listElement;
    
    // 响应式数据
    $: items = activeTab === 'subtitles' ? subtitles : (activeTab === 'danmakus' ? danmakus : summaryItems);
    $: hasItems = items.length > 0;
    $: exportTitle = currentMedia?.title ? `## ${currentMedia.title} ${activeTab === 'subtitles' ? (i18n?.assistant?.tabs?.subtitles || '字幕') : (activeTab === 'danmakus' ? (i18n?.assistant?.tabs?.danmakus || '弹幕') : (i18n?.assistant?.tabs?.summary || 'AI总结'))}\n\n` : '';
    $: exportBtnText = i18n?.assistant?.exportAll || "全部导出";
    $: resumeBtnText = i18n?.assistant?.resumeScroll || "恢复滚动";
    $: emptyText = activeTab === 'subtitles' 
        ? (i18n?.assistant?.subtitles?.noItems || "当前视频没有可用的字幕")
        : (activeTab === 'danmakus'
            ? (i18n?.assistant?.danmakus?.noItems || "当前视频没有可用的弹幕")
            : (!currentMedia?.bvid 
                ? (i18n?.assistant?.summary?.onlyForBilibili || "AI总结功能仅支持哔哩哔哩视频。")
                : (i18n?.assistant?.summary?.noItems || "当前视频没有可用的AI总结")));
    
    // 监听媒体变化并加载字幕和摘要
    $: if (currentMedia?.url && player) {
        loadContent();
        startTracking();
    }
    
    // 面板切换处理
    function changePanelTab(tabId) {
        if (tabId === activeTabId) return;
        window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', { 
            detail: { tabId } 
        }));
    }
    
    // 生命周期
    onMount(() => {
        // 监听面板激活
        const handleTabActivate = (e: any) => {
            if (e.detail?.tabId) {
                activeTabId = e.detail.tabId;
            }
        };
        
        window.addEventListener('mediaPlayerTabActivate', handleTabActivate);
        
        // 初始化时尝试加载内容
        if (player && currentMedia?.url) {
            loadContent();
            startTracking();
        }
        
        // 监听媒体更新
        const handlePlayerUpdate = (e: any) => {
            if (e.detail?.media && e.detail.media !== currentMedia) {
                setTimeout(loadContent, 100);
            }
        };
        
        window.addEventListener('mediaPlayerUpdate', handlePlayerUpdate);
        
        return () => {
            window.removeEventListener('mediaPlayerTabActivate', handleTabActivate);
            window.removeEventListener('mediaPlayerUpdate', handlePlayerUpdate);
            stopTracking();
        };
    });
    
    // 极简字幕追踪
    function startTracking() {
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            if (!player || !items.length || !listElement) return;
            
            // 查找当前项目索引
            const time = player.getCurrentTime();
            const prev = currentSubtitleIndex;
            currentSubtitleIndex = activeTab === 'subtitles'
                ? items.findIndex((i, idx, arr) => time >= i.startTime && (time < i.endTime || idx === arr.length - 1))
                : items.reduce((b, i, idx) => (i.startTime <= time && (b === -1 || i.startTime > items[b].startTime) ? idx : b), -1);
            
            // 项目变化时更新滚动
            if (currentSubtitleIndex !== -1 && currentSubtitleIndex !== prev) {
                updateScroll();
            }
        }, 500);
    }

    // 当前滚动逻辑简化
    function updateScroll(force = false) {
        if (currentSubtitleIndex === -1 || !listElement) return;
        
        const el = listElement.querySelector(`.subtitle-item:nth-child(${currentSubtitleIndex + 1})`);
        if (!el || (!force && !autoScrollEnabled)) return;
        
        // 简化：直接执行滚动
        el.scrollIntoView({behavior:'smooth', block:'center'});
    }
    
    // 公共函数
    function resumeAutoScroll() { 
        autoScrollEnabled = true; 
        updateScroll(true);
    }
    function stopTracking() { if (timer) { clearInterval(timer); timer = null; } }
    
    // 加载字幕、弹幕和AI摘要
    async function loadContent() {
        // 重置状态
        subtitles = [];
        summaryItems = [];
        danmakus = [];
        currentSubtitleIndex = -1;
        autoScrollEnabled = true;
    
        // 加载字幕
        isLoadingSubtitles = true;
        try {
            if (currentMedia.bvid && currentMedia.cid) {
                // B站视频字幕
                subtitles = await SubtitleManager.loadBilibiliSubtitle(
                    currentMedia.bvid, 
                    currentMedia.cid, 
                    configManager.getConfig()
                );
            } else if (currentMedia.url) {
                // 本地或AList字幕
                const options = await SubtitleManager.getSubtitleForMedia(currentMedia.url);
                if (options) {
                    subtitles = await SubtitleManager.loadSubtitle(options.url, options.type);
                }
            }
        } catch (e) {
            console.error('[Assistant] 加载字幕失败:', e);
        } finally {
            isLoadingSubtitles = false;
        }
        
        // 加载弹幕
        isLoadingDanmakus = true;
        try {
            if (currentMedia.bvid && currentMedia.cid) {
                // B站视频弹幕
                const danmakuList = await DanmakuManager.getBiliDanmaku(
                    currentMedia.cid,
                    configManager.getConfig()
                );
                danmakus = danmakuList || [];
            } else if (currentMedia.url) {
                // 本地弹幕，统一使用与字幕相同的查找和加载方式
                const options = await DanmakuManager.getDanmakuFileForMedia(currentMedia.url);
                if (options) {
                    danmakus = await DanmakuManager.loadDanmaku(options.url, options.type);
                }
            }
        } catch (e) {
            console.error('[Assistant] 加载弹幕失败:', e);
        } finally {
            isLoadingDanmakus = false;
        }
        
        // 加载B站AI总结（仅限B站视频）
        if (currentMedia.bvid && currentMedia.cid) {
            isLoadingSummary = true;
            try {
                const config = configManager.getConfig();
                const upMid = currentMedia.artistId 
                    || (await BilibiliParser.getVideoInfo(`https://www.bilibili.com/video/${currentMedia.bvid}/`)?.then(info => info?.artistId))
                    || config.bilibiliLogin?.userInfo?.mid;
                
                const result = await BilibiliParser.getVideoAiSummary(currentMedia.bvid, currentMedia.cid, upMid, config);
                
                if (result?.code === 0 && result?.data?.code === 0 && result.data.model_result) {
                    const model = result.data.model_result;
                    summaryItems = [
                        {startTime: 0, text: model.summary, type: 'summary'},
                        ...(model.outline?.flatMap(section => [
                            {startTime: section.timestamp, text: section.title, type: 'chapter'},
                            ...section.part_outline.map(point => ({
                                startTime: point.timestamp, 
                                text: point.content
                            }))
                        ]) || [])
                    ];
                }
            } catch (e) {
                console.error('[Assistant] 加载AI总结失败:', e);
            } finally {
                isLoadingSummary = false;
            }
        }
    }
    
    // 工具函数
    const getTimeDisplay = item => activeTab === 'summary' && item.type
        ? (i18n?.assistant?.summary?.[item.type] || (item.type === 'summary' ? (i18n?.assistant?.summary?.summary || '总结') : (i18n?.assistant?.summary?.chapter || '章节')))
        : SubtitleManager.formatTime(item.startTime);
        
    const jumpToTime = time => player?.seekTo(time);
    
    async function exportItem(item) {
        try {
            const text = item.type ? `【${getTimeDisplay(item)}】${item.text}` : item.text;
            const content = await createTimestampLinkCallback(false, item.startTime, undefined, text)
                .catch(() => `- [${getTimeDisplay(item)}] ${text}`);
            await insertContentCallback(content || `- [${getTimeDisplay(item)}] ${text}`);
            showMessage(i18n?.assistant?.exportSuccess || "导出成功");
        } catch (e) {
            console.error('[Assistant] 导出失败:', e);
            showMessage(i18n?.assistant?.exportFailed || "导出失败");
        }
    }
    
    async function exportAll() {
        if (!items.length) {
            showMessage(i18n?.assistant?.noExportItems || "没有可导出的内容");
            return;
        }
        
        try {
            const links = await Promise.all(items.map(async item => {
                const text = item.type ? `【${getTimeDisplay(item)}】${item.text}` : item.text;
                const link = await createTimestampLinkCallback(false, item.startTime, undefined, text)
                    .catch(() => `- [${getTimeDisplay(item)}] ${text}`);
                return link || `- [${getTimeDisplay(item)}] ${text}`;
            }));
            
            await insertContentCallback(exportTitle + links.join('\n'));
            showMessage(i18n?.assistant?.exportSuccess || "导出成功");
        } catch (e) {
            console.error('[Assistant] 导出全部失败:', e);
            showMessage(i18n?.assistant?.exportFailed || "导出失败");
        }
    }
    
    // Tab切换时重启追踪
    $: if (activeTab) {
        currentSubtitleIndex = -1;
        autoScrollEnabled = true;
        if (player && items.length) setTimeout(startTracking, 100);
    }
    
    // 组件销毁时清理
    onDestroy(stopTracking);
</script>

<div class="playlist assistant {className}" class:hidden={hidden}>
    <div class="playlist-header">
        <div class="panel-nav">
            <h3 class:active={activeTabId === 'playlist'} on:click={() => changePanelTab('playlist')}>
                {i18n.playList?.title || "列表"}
            </h3>
            <h3 class:active={activeTabId === 'assistant'} on:click={() => changePanelTab('assistant')}>
                {i18n.assistant?.title || "助手"}
            </h3>
            <h3 class:active={activeTabId === 'settings'} on:click={() => changePanelTab('settings')}>
                {i18n.setting?.title || "设置"}
            </h3>
        </div>
        <div class="header-controls">
            <span class="playlist-count">{hasItems ? `${items.length}${i18n?.assistant?.itemCount || "条"}` : (i18n?.assistant?.noItems || "无")}{activeTab === 'subtitles' ? (i18n?.assistant?.tabs?.subtitles || '字幕') : (activeTab === 'danmakus' ? (i18n?.assistant?.tabs?.danmakus || '弹幕') : (i18n?.assistant?.tabs?.summary || '总结'))}</span>
        </div>
    </div>
    
    <div class="playlist-tabs">
        <button class="tab" class:active={activeTab === 'subtitles'} on:click={() => activeTab = 'subtitles'}>
            {i18n?.assistant?.tabs?.subtitles || "字幕列表"}
        </button>
        <button class="tab" class:active={activeTab === 'danmakus'} on:click={() => activeTab = 'danmakus'}>
            {i18n?.assistant?.tabs?.danmakus || "弹幕列表"}
        </button>
        <button class="tab" class:active={activeTab === 'summary'} on:click={() => activeTab = 'summary'}>
            {i18n?.assistant?.tabs?.summary || "视频总结"}
        </button>
    </div>
    
    <div class="playlist-content">
        {#if (activeTab === 'summary' && isLoadingSummary) || (activeTab === 'subtitles' && isLoadingSubtitles) || (activeTab === 'danmakus' && isLoadingDanmakus)}
            <div class="playlist-empty">
                {activeTab === 'summary' 
                    ? (i18n?.assistant?.summary?.loading || "正在加载AI总结...") 
                    : (activeTab === 'danmakus'
                        ? (i18n?.assistant?.danmakus?.loading || "正在加载弹幕...")
                        : (i18n?.assistant?.subtitles?.loading || "正在加载字幕..."))}
            </div>
        {:else if hasItems}
            <div class="subtitle-list" bind:this={listElement} 
                on:scroll|capture={() => autoScrollEnabled = false}
                on:wheel={() => autoScrollEnabled = false}
                on:touchmove={() => autoScrollEnabled = false}>
                {#each items as item, index}
                    <div class="subtitle-item" 
                         on:click={() => jumpToTime(item.startTime)}
                         class:current={index === currentSubtitleIndex}>
                        <span class="subtitle-time">{getTimeDisplay(item)}</span>
                        <span class="subtitle-text">{item.text}</span>
                        <button class="action-btn" on:click|stopPropagation={() => exportItem(item)} title={i18n?.assistant?.[activeTab]?.export || "导出"}>
                            <svg class="icon"><use xlink:href="#iconCopy"></use></svg>
                        </button>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="playlist-empty">{emptyText}</div>
        {/if}
    </div>
    
    {#if hasItems}
        <div class="playlist-footer assistant-footer">
            <button class="add-btn" on:click={exportAll}>
                <svg class="icon"><use xlink:href="#iconDownload"></use></svg>
                <span>{exportBtnText}</span>
            </button>
            {#if !autoScrollEnabled}
                <button class="add-btn" on:click={resumeAutoScroll}>
                    <svg class="icon"><use xlink:href="#iconPlay"></use></svg>
                    <span>{resumeBtnText}</span>
                </button>
            {/if}
        </div>
    {/if}
</div>