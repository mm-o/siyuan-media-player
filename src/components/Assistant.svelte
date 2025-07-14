<script lang="ts">
    import { SubtitleManager } from '../core/subtitle';
    import { DanmakuManager } from '../core/danmaku';
    import { BilibiliParser } from '../core/bilibili';
    import { onDestroy, onMount } from 'svelte';
    import { showMessage } from 'siyuan';
    // @ts-ignore
    import Tabs from './Tabs.svelte';

    // 组件属性
    export let className = '', hidden = false, i18n: any = {}, currentMedia: any = null, player: any = null;
    export let insertContentCallback, createTimestampLinkCallback;
    export let activeTabId = 'assistant';
    export let plugin: any;
    
    // 配置管理
    const getConfig = async () => {
        const data = await plugin.loadData('config.json');
        return (data && typeof data === 'object' && !Array.isArray(data)) ? { settings: {}, bilibiliLogin: undefined, ...data } : { settings: {}, bilibiliLogin: undefined };
    };

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
    
    // 媒体变化监听 - 极简版
    $: {
        stopTracking();
        if (currentMedia?.url && player) {
            loadContent();
            startTracking();
        } else {
            clearContent();
        }
    }

    // 清理内容状态
    function clearContent() {
        subtitles = [];
        summaryItems = [];
        danmakus = [];
        currentSubtitleIndex = -1;
        autoScrollEnabled = true;
        isLoadingSubtitles = false;
        isLoadingSummary = false;
        isLoadingDanmakus = false;
    }



    // 生命周期
    onMount(() => {
        const handleTabActivate = (e: any) => {
            if (e.detail?.tabId) activeTabId = e.detail.tabId;
        };
        window.addEventListener('mediaPlayerTabActivate', handleTabActivate);
        return () => {
            window.removeEventListener('mediaPlayerTabActivate', handleTabActivate);
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
    
    // 加载内容 - 极简版
    async function loadContent() {
        if (!currentMedia?.url) return clearContent();

        clearContent();
        isLoadingSubtitles = isLoadingDanmakus = isLoadingSummary = true;

        try {
            const config = await getConfig();
            const { bvid, cid, url } = currentMedia;

            // 并行加载所有内容
            const [subtitleResult, danmakuResult, summaryResult] = await Promise.allSettled([
                // 字幕
                bvid && cid
                    ? SubtitleManager.loadBilibiliSubtitle(bvid, cid, config)
                    : url ? SubtitleManager.getSubtitleForMedia(url).then(opt => opt ? SubtitleManager.loadSubtitle(opt.url, opt.type) : []) : [],

                // 弹幕
                bvid && cid
                    ? DanmakuManager.getBiliDanmaku(cid, config)
                    : url ? DanmakuManager.getDanmakuFileForMedia(url).then(opt => opt ? DanmakuManager.loadDanmaku(opt.url, opt.type) : []) : [],

                // 总结
                bvid && cid
                    ? BilibiliParser.getVideoAiSummary(bvid, cid, currentMedia.artistId || config.settings?.bilibiliLogin?.mid, config)
                        .then(result => result?.code === 0 && result?.data?.code === 0 && result.data.model_result
                            ? [{ startTime: 0, text: result.data.model_result.summary, type: 'summary' },
                               ...(result.data.model_result.outline?.flatMap(section => [
                                   { startTime: section.timestamp, text: section.title, type: 'chapter' },
                                   ...section.part_outline.map(point => ({ startTime: point.timestamp, text: point.content }))
                               ]) || [])]
                            : [])
                    : []
            ]);

            subtitles = subtitleResult.status === 'fulfilled' ? subtitleResult.value || [] : [];
            danmakus = danmakuResult.status === 'fulfilled' ? danmakuResult.value || [] : [];
            summaryItems = summaryResult.status === 'fulfilled' ? summaryResult.value || [] : [];

        } catch (e) {
            console.error('[Assistant] 加载内容失败:', e);
        } finally {
            isLoadingSubtitles = isLoadingDanmakus = isLoadingSummary = false;
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
    
    // Tab切换时重置状态
    $: if (activeTab) {
        currentSubtitleIndex = -1;
        autoScrollEnabled = true;
    }
    
    // 组件销毁时清理
    onDestroy(stopTracking);
</script>

<div class="playlist assistant {className}" class:hidden={hidden}>
    <!-- 统一导航 -->
    <Tabs {activeTabId} {i18n}>
        <svelte:fragment slot="controls">
            <span class="playlist-count">{hasItems ? `${items.length}${i18n?.assistant?.itemCount || "条"}` : (i18n?.assistant?.noItems || "无")}{activeTab === 'subtitles' ? (i18n?.assistant?.tabs?.subtitles || '字幕') : (activeTab === 'danmakus' ? (i18n?.assistant?.tabs?.danmakus || '弹幕') : (i18n?.assistant?.tabs?.summary || '总结'))}</span>
        </svelte:fragment>
    </Tabs>
    
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