<script lang="ts">
    // 统一的面板导航组件 - 极简优雅实现
    export let activeTabId: string;
    export let i18n: any = {};

    // 标签页配置 - 统一管理
    const tabs = [
        { id: 'playlist', title: () => i18n.playList?.title || '列表' },
        { id: 'assistant', title: () => i18n.assistant?.title || '助手' },
        { id: 'notes', title: () => i18n.notes?.title || '笔记' },
        { id: 'settings', title: () => i18n.setting?.title || '设置' }
    ];

    // 切换标签页 - 统一事件处理
    function switchTab(tabId: string) {
        if (tabId === activeTabId) return;
        window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', {
            detail: { tabId }
        }));
    }
</script>

<div class="playlist-header">
    <div class="panel-nav">
        {#each tabs as tab}
            <h3
                class:active={activeTabId === tab.id}
                on:click={() => switchTab(tab.id)}
            >
                {tab.title()}
            </h3>
        {/each}
    </div>
    <div class="header-controls">
        <slot name="controls" />
    </div>
</div>
