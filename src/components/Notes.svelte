<script lang="ts">
    import { onMount } from 'svelte';
    import { showMessage, openTab, Protyle, Menu } from 'siyuan';
    // @ts-ignore
    import Tabs from './Tabs.svelte';

    // 组件属性
    export let className = '', hidden = false, i18n: any = {}, plugin: any;
    export const config: any = {}, activeTabId = 'notes';

    // 组件状态
    let notesTabs = [], activeTab = '', isAdding = false, isProcessing = false;
    let addInputRef: HTMLInputElement, editingTab = '', editInputRef: HTMLInputElement;

    // 配置管理
    const loadNotesConfig = async () => {
        try {
            const cfg = await plugin.loadData('config.json') || {};
            const notes = { notesTabs: [], activeNoteTab: '', ...(cfg.notes || {}) };
            [notesTabs, activeTab] = [notes.notesTabs, notes.activeNoteTab || (notes.notesTabs.length > 0 ? notes.notesTabs[0].id : '')];
        } catch (e) {
            [notesTabs, activeTab] = [[], ''];
        }
    };

    const saveNotesConfig = async () => {
        try {
            const cfg = await plugin.loadData('config.json') || {};
            cfg.notes = { notesTabs, activeNoteTab: activeTab };
            await plugin.saveData('config.json', cfg, 2);
            window.dispatchEvent(new CustomEvent('configUpdated', { detail: cfg }));
        } catch (e) {}
    };

    // 工具函数
    const validateBlockId = (id: string) => /^[0-9]{14}-[a-z0-9]{7}$/.test(id);
    const openInSiYuan = (blockId: string) => openTab({ app: plugin.app, doc: { id: blockId } });
    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showMessage('已复制到剪贴板', 2000);
        } catch (e) {
            showMessage('复制失败', 2000);
        }
    };

    const getBlockInfo = async (blockId: string) => {
        try {
            const response = await fetch('/api/query/sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stmt: `SELECT id, content, type, root_id FROM blocks WHERE id = '${blockId}'` })
            });
            const result = await response.json();
            if (result.code === 0 && result.data?.length > 0) {
                const block = result.data[0];
                return {
                    id: block.id,
                    title: block.content || i18n.notes?.untitled || '无标题',
                    type: block.type,
                    isDocument: block.id === block.root_id
                };
            }
        } catch (e) {}
        return null;
    };

    // 输入处理
    const input = (e: Event) => {
        if (e instanceof KeyboardEvent && e.key !== 'Enter') return;
        if (isProcessing) return;
        const value = ((e.target as HTMLInputElement).value || '').trim();
        if (!value) return (isAdding = false);
        isProcessing = true;
        addNoteTab(value).finally(() => [isProcessing, isAdding] = [false, false]);
    };

    const showAddInput = () => (isAdding = true, setTimeout(() => addInputRef?.focus(), 0));

    const editInput = (e: Event, tabId: string) => {
        if (e instanceof KeyboardEvent && e.key !== 'Enter') return;
        const value = ((e.target as HTMLInputElement).value || '').trim();
        if (!value) return (editingTab = '');
        renameTab(tabId, value);
    };

    // 标签管理
    const addNoteTab = async (blockId: string) => {
        if (!validateBlockId(blockId)) return showMessage(i18n.notes?.invalidId || '无效的ID格式');
        if (notesTabs.some(tab => tab.blockId === blockId)) return;
        try {
            const blockInfo = await getBlockInfo(blockId);
            if (!blockInfo) return showMessage(i18n.notes?.blockNotFound || '找不到对应的文档或块');
            const newTab = { id: Date.now().toString(), name: blockInfo.title.slice(0, 4), blockId, createTime: Date.now(), isDocument: blockInfo.isDocument };
            notesTabs = [...notesTabs, newTab];
            activeTab = newTab.id;
            await saveNotesConfig();
        } catch (error) {
            showMessage(i18n.notes?.error || '添加失败');
        }
    };

    const deleteTab = async (tabId: string) => {
        notesTabs = notesTabs.filter(tab => tab.id !== tabId);
        if (activeTab === tabId) activeTab = notesTabs.length > 0 ? notesTabs[0].id : '';
        await saveNotesConfig();
    };

    const switchTab = (tabId: string) => {
        if (activeTab === tabId) return;
        [activeTab] = [tabId];
        saveNotesConfig();
    };

    const renameTab = async (tabId: string, newName: string) => {
        if (!newName.trim()) return;
        const tab = notesTabs.find(t => t.id === tabId);
        if (!tab) return;
        tab.name = newName.trim().slice(0, 4);
        notesTabs = [...notesTabs];
        await saveNotesConfig();
        editingTab = '';
    };

    // 右键菜单
    const menu = (e: MouseEvent, tab: any) => {
        const m = new Menu('tabMenu');
        [
            ["iconEdit", i18n.notes?.renameTab || "重命名", () => (m.close(), editingTab = tab.id, setTimeout(() => editInputRef?.focus(), 0))],
            ["iconFocus", i18n.notes?.openInSiYuan || "在思源中打开", () => openInSiYuan(tab.blockId)],
            ["iconCopy", i18n.notes?.copyId || "复制ID", () => copyToClipboard(tab.blockId)],
            ["iconTrashcan", i18n.notes?.deleteTab || "删除标签", () => deleteTab(tab.id)]
        ].forEach(([icon, label, action]) => m.addItem({ icon, label, click: action }));
        m.open({ x: e.clientX, y: e.clientY });
    };

    // Protyle管理
    const initProtyle = (element: HTMLElement, tab: any) => (
        new Protyle(plugin.app, element, {
            action: ['cb-get-all'],
            blockId: tab.blockId,
            render: { background: false, title: false, icon: false, gutter: true, scroll: true, breadcrumb: false, breadcrumbDocName: false }
        }),
        { destroy() {} }
    );

    // 生命周期
    onMount(loadNotesConfig);
</script>

<div class="panel {className}" class:hidden>
    <Tabs {activeTabId} {i18n}>
        <svelte:fragment slot="controls">
            <span class="panel-count">{notesTabs.length} 项</span>
        </svelte:fragment>
    </Tabs>

    <div class="panel-tabs">
        {#each notesTabs as tab (tab.id)}
            {#if editingTab === tab.id}
                <input
                    bind:this={editInputRef}
                    type="text"
                    class="tab-input"
                    value={tab.name}
                    on:blur={e => editInput(e, tab.id)}
                    on:keydown={e => editInput(e, tab.id)}
                />
            {:else}
                <button
                    class="tab"
                    class:active={activeTab === tab.id}
                    on:click={() => switchTab(tab.id)}
                    on:contextmenu|preventDefault={e => menu(e, tab)}
                    title={tab.name}
                >
                    {tab.name}
                </button>
            {/if}
        {/each}
        {#if isAdding}
            <input
                bind:this={addInputRef}
                type="text"
                class="tab-input"
                placeholder={i18n.notes?.inputPlaceholder || "输入文档ID或块ID..."}
                on:blur={input}
                on:keydown={input}
            />
        {:else}
            <button class="tab tab-add" on:click={showAddInput}>+</button>
        {/if}
    </div>

    <div class="panel-content">
        {#if notesTabs.length === 0}
            <div class="panel-empty">
                {i18n.notes?.emptyState || '暂无笔记标签，点击添加按钮开始'}
            </div>
        {:else}
            {#each notesTabs as tab (tab.id)}
                <div
                    style="display: {activeTab === tab.id ? 'block' : 'none'}; height: 100%;"
                    class="panel-content"
                    use:initProtyle={tab}
                ></div>
            {/each}
        {/if}
    </div>
</div>
