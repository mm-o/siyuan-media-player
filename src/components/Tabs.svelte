<script lang="ts">
    export let activeTabId: string, i18n: any = {};

    // 标签页配置
    const tabs = [
        { id: 'playlist', title: () => i18n.playList?.title || '列表' },
        { id: 'assistant', title: () => i18n.assistant?.title || '助手' },
        { id: 'notes', title: () => i18n.notes?.title || '笔记' },
        { id: 'settings', title: () => i18n.setting?.title || '设置' }
    ];

    // 切换标签页
    const switchTab = (tabId: string) => {
        if (tabId !== activeTabId) window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', { detail: { tabId } }));
    };
</script>

<div class="playlist-header">
    <div class="panel-nav">
        {#each tabs as tab}
            <h3 class:active={activeTabId === tab.id} on:click={() => switchTab(tab.id)}>{tab.title()}</h3>
        {/each}
    </div>
    <div class="header-controls"><slot name="controls" /></div>
</div>