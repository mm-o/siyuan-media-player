<script lang="ts">
    import { SubtitleManager } from '../core/subtitle';
    import { BilibiliParser } from '../core/bilibili';
    import { onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';

    // 组件属性
    export let configManager, className = '', hidden = false, i18n: any = {}, currentMedia: any = null, player: any = null;
    export let insertContentCallback, createTimestampLinkCallback;

    // 组件状态
    let activeTab = 'subtitles';
    let subtitles = [], summaryItems = [], currentSubtitleIndex = -1;
    let isLoadingSubtitles = false, isLoadingSummary = false;
    let timer = null;
    let autoScrollEnabled = true;
    let listElement;
    
    // 响应式数据
    $: items = activeTab === 'subtitles' ? subtitles : summaryItems;
    $: hasItems = items.length > 0;
    $: exportTitle = currentMedia?.title ? `## ${currentMedia.title} ${activeTab === 'subtitles' ? (i18n?.assistant?.tabs?.subtitles || '字幕') : (i18n?.assistant?.tabs?.summary || 'AI总结')}\n\n` : '';
    $: exportBtnText = i18n?.assistant?.exportAll || "全部导出";
    $: resumeBtnText = i18n?.assistant?.resumeScroll || "恢复滚动";
    $: emptyText = activeTab === 'subtitles' 
        ? (i18n?.assistant?.subtitles?.noItems || "当前视频没有可用的字幕")
        : (!currentMedia?.bvid 
            ? (i18n?.assistant?.summary?.onlyForBilibili || "AI总结功能仅支持哔哩哔哩视频。")
            : (i18n?.assistant?.summary?.noItems || "当前视频没有可用的AI总结"));
    
    // 监听媒体变化并加载字幕和摘要
    $: if (currentMedia?.url && player) {
        loadContent();
        startTracking();
    }
    
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
            
            // 项目变化且有效时处理
            if (currentSubtitleIndex !== -1 && currentSubtitleIndex !== prev) {
                updateScroll();
            }
        }, 500);
    }

    // 核心滚动逻辑
    function updateScroll(force = false) {
        if (currentSubtitleIndex === -1 || !listElement) return;
        
        const el = listElement.querySelector(`.subtitle-item:nth-child(${currentSubtitleIndex + 1})`);
        if (!el) return;
        
        // 检查是否在中间区域
        if (!force) {
            const r1 = el.getBoundingClientRect();
            const r2 = listElement.getBoundingClientRect();
            const mid1 = r2.top + r2.height/3;
            const mid2 = r2.top + r2.height*2/3;
            autoScrollEnabled = r1.top <= mid2 && r1.bottom >= mid1;
        }
        
        // 执行滚动
        if (force || autoScrollEnabled) {
            el.scrollIntoView({behavior:'smooth', block:'center'});
        }
    }
    
    // 公共函数
    function resumeAutoScroll() { autoScrollEnabled = true; updateScroll(true); }
    function stopTracking() { if (timer) { clearInterval(timer); timer = null; } }
    function handleScroll() {}
    
    // 加载字幕和AI摘要
    async function loadContent() {
        // 重置状态
        subtitles = [];
        summaryItems = [];
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
            } else if (currentMedia.url?.startsWith('file://')) {
                // 本地视频字幕
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
        <h3>{i18n?.assistant?.title || "助手"}</h3>
        <div class="header-controls">
            <span class="playlist-count">{hasItems ? `${items.length}${i18n?.assistant?.itemCount || "条"}` : (i18n?.assistant?.noItems || "无")}{activeTab === 'subtitles' ? (i18n?.assistant?.tabs?.subtitles || '字幕') : (i18n?.assistant?.tabs?.summary || '总结')}</span>
        </div>
    </div>
    
    <div class="playlist-tabs">
        <button class="tab" class:active={activeTab === 'subtitles'} on:click={() => activeTab = 'subtitles'}>
            {i18n?.assistant?.tabs?.subtitles || "字幕列表"}
        </button>
        <button class="tab" class:active={activeTab === 'summary'} on:click={() => activeTab = 'summary'}>
            {i18n?.assistant?.tabs?.summary || "视频总结"}
        </button>
    </div>
    
    <div class="playlist-content">
        {#if (activeTab === 'summary' && isLoadingSummary) || (activeTab === 'subtitles' && isLoadingSubtitles)}
            <div class="playlist-empty">
                {activeTab === 'summary' 
                    ? (i18n?.assistant?.summary?.loading || "正在加载AI总结...") 
                    : (i18n?.assistant?.subtitles?.loading || "正在加载字幕...")}
            </div>
        {:else if hasItems}
            <div class="subtitle-list" bind:this={listElement} on:scroll={handleScroll}>
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
        <div class="assistant-footer">
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