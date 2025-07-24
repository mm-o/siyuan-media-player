<script lang="ts">
    import { onMount } from 'svelte';
    import { showMessage, openTab, Protyle, Menu } from 'siyuan';
    // @ts-ignore
    import Tabs from './Tabs.svelte';

    // 组件属性
    export let className = '', hidden = false, i18n: any = {}, plugin: any;
    export const activeTabId = 'notes';

    // 状态
    let notesTabs = [], activeTab = '', isAdding = false, isProcessing = false, editingTab = '';
    let addInputRef: HTMLInputElement, editInputRef: HTMLInputElement;
    let filterTypes = [], filteredBlocks = [];
    const filterOptions = [
        { type: 'timestamp', label: '时间戳', icon: 'iconClock' },
        { type: 'loop', label: '循环片段', icon: 'iconRefresh' },
        { type: 'screenshot', label: '截图', icon: 'iconImage' },
        { type: 'mediacard', label: '媒体卡片', icon: 'iconBoth' }
    ];

    // 配置
    const loadNotesConfig = async () => {
        try {
            const cfg = await plugin.loadData('config.json') || {};
            const notes = { notesTabs: [], activeNoteTab: '', ...(cfg.notes || {}) };
            [notesTabs, activeTab] = [notes.notesTabs, notes.activeNoteTab || notes.notesTabs[0]?.id || ''];
        } catch { [notesTabs, activeTab] = [[], '']; }
    };

    const saveNotesConfig = async () => {
        try {
            const cfg = await plugin.loadData('config.json') || {};
            cfg.notes = { notesTabs, activeNoteTab: activeTab };
            await plugin.saveData('config.json', cfg, 2);
            window.dispatchEvent(new CustomEvent('configUpdated', { detail: cfg }));
        } catch {}
    };

    // 工具
    const validateBlockId = (id: string) => /^[0-9]{14}-[a-z0-9]{7}$/.test(id);
    const openInSiYuan = (blockId: string) => openTab({ app: plugin.app, doc: { id: blockId } });
    const copyToClipboard = async (text: string) => {
        try { await navigator.clipboard.writeText(text); showMessage('已复制到剪贴板', 2000); }
        catch { showMessage('复制失败', 2000); }
    };

    const getBlockInfo = async (blockId: string) => {
        try {
            const { data } = await fetch('/api/query/sql', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stmt: `SELECT id, content, type, root_id FROM blocks WHERE id = '${blockId}'` })
            }).then(r => r.json());
            const block = data?.[0];
            return block ? { id: block.id, title: block.content || '无标题', type: block.type, isDocument: block.id === block.root_id } : null;
        } catch { return null; }
    };

    // 输入
    const input = (e: Event) => {
        if (e instanceof KeyboardEvent && e.key !== 'Enter' || isProcessing) return;
        const value = ((e.target as HTMLInputElement).value || '').trim();
        if (!value) return (isAdding = false);
        isProcessing = true;
        addNoteTab(value).finally(() => [isProcessing, isAdding] = [false, false]);
    };

    const showAddInput = () => (isAdding = true, setTimeout(() => addInputRef?.focus(), 0));
    const editInput = (e: Event, tabId: string) => {
        if (e instanceof KeyboardEvent && e.key !== 'Enter') return;
        const value = ((e.target as HTMLInputElement).value || '').trim();
        value ? renameTab(tabId, value) : (editingTab = '');
    };

    // 标签
    const addNoteTab = async (blockId: string) => {
        if (!validateBlockId(blockId)) return showMessage('无效的ID格式');
        if (notesTabs.some(tab => tab.blockId === blockId)) return;
        try {
            const blockInfo = await getBlockInfo(blockId);
            if (!blockInfo) return showMessage('找不到对应的文档或块');
            const newTab = { id: Date.now().toString(), name: blockInfo.title.slice(0, 4), blockId, createTime: Date.now(), isDocument: blockInfo.isDocument };
            notesTabs = [...notesTabs, newTab]; activeTab = newTab.id; await saveNotesConfig();
        } catch { showMessage('添加失败'); }
    };

    const deleteTab = async (tabId: string) => {
        notesTabs = notesTabs.filter(tab => tab.id !== tabId);
        activeTab === tabId && (activeTab = notesTabs[0]?.id || '');
        await saveNotesConfig();
    };

    const switchTab = async (tabId: string) => activeTab !== tabId && (activeTab = tabId, filterTypes.length && (filteredBlocks = await queryMediaBlocks(filterTypes)), saveNotesConfig());
    const renameTab = async (tabId: string, newName: string) => {
        const tab = notesTabs.find(t => t.id === tabId);
        if (tab && newName.trim()) { tab.name = newName.trim().slice(0, 4); notesTabs = [...notesTabs]; await saveNotesConfig(); }
        editingTab = '';
    };

    // 菜单
    const menu = (e: MouseEvent, tab: any) => {
        const m = new Menu('tabMenu');
        [["iconEdit", i18n.notes?.renameTab || "重命名", () => (m.close(), editingTab = tab.id, setTimeout(() => editInputRef?.focus(), 0))],
         ["iconFocus", i18n.notes?.openInSiYuan || "在思源中打开", () => openInSiYuan(tab.blockId)],
         ["iconCopy", i18n.notes?.copyId || "复制ID", () => copyToClipboard(tab.blockId)],
         ["iconTrashcan", i18n.notes?.deleteTab || "删除标签", () => deleteTab(tab.id)]
        ].forEach(([icon, label, action]) => m.addItem({ icon, label, click: action }));
        m.open({ x: e.clientX, y: e.clientY });
    };

    // Protyle
    const initProtyle = (element: HTMLElement, tab: any) => (
        new Protyle(plugin.app, element, { action: ['cb-get-all'], blockId: tab.blockId, render: { background: false, title: false, icon: false, gutter: true, scroll: true, breadcrumb: false, breadcrumbDocName: false } }),
        { destroy() {} }
    );

    // 筛选
    const queryMediaBlocks = async (types: string[]) => {
        const tab = notesTabs.find(t => t.id === activeTab);
        if (!tab || !types.length) return [];
        try {
            const { data } = await fetch('/api/query/sql', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stmt: `SELECT * FROM blocks WHERE root_id = '${tab.blockId}' AND id IN (SELECT block_id FROM attributes WHERE name = 'custom-media' AND value IN (${types.map(t => `'${t}'`).join(',')})) ORDER BY created ASC` })
            }).then(r => r.json());
            return data ? await Promise.all(data.map(async block => ({
                ...block,
                ...(await fetch('/api/query/sql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stmt: `SELECT name, value FROM attributes WHERE block_id = '${block.id}'` }) })
                .then(r => r.json()).then(({ data }) => data?.reduce((attrs, { name, value }) => ({ ...attrs, [name.replace('-', '_')]: value }), {}) || {}))
            }))) : [];
        } catch { return []; }
    };

    const handleAction = (e: MouseEvent) => {
        e.stopPropagation();
        const m = new Menu('filterMenu');
        filterOptions.forEach(({ type, label, icon }) => m.addItem({ icon, label, click: () => toggleFilterType(type), current: filterTypes.includes(type) }));
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        m.open({ x: rect.right - 140, y: rect.top - 10 });
    };

    const toggleFilterType = async (type: string) => (
        filterTypes = filterTypes.includes(type) ? filterTypes.filter(t => t !== type) : [...filterTypes, type],
        filteredBlocks = filterTypes.length ? await queryMediaBlocks(filterTypes) : []
    );

    const openBlock = (blockId: string) => openTab({ blockId, action: ['cb-get-focus'] });

    // 设置当前文档上下文
    $: activeTab && ((tab) => tab && ((window as any).__activeDocumentId = tab.blockId, window.dispatchEvent(new CustomEvent('setActiveDocument', { detail: { blockId: tab.blockId, isDocument: tab.isDocument } }))))(notesTabs.find(t => t.id === activeTab));

    onMount(() => (loadNotesConfig(), window.addEventListener('refreshNotesFilter', () => filterTypes.length && queryMediaBlocks(filterTypes).then(blocks => filteredBlocks = blocks))));
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
                <input bind:this={editInputRef} type="text" class="tab-input" value={tab.name} on:blur={e => editInput(e, tab.id)} on:keydown={e => editInput(e, tab.id)} />
            {:else}
                <button class="tab" class:active={activeTab === tab.id} on:click={() => switchTab(tab.id)} on:contextmenu|preventDefault={e => menu(e, tab)} title={tab.name}>{tab.name}</button>
            {/if}
        {/each}
        {#if isAdding}
            <input bind:this={addInputRef} type="text" class="tab-input" placeholder="输入文档ID或块ID..." on:blur={input} on:keydown={input} />
        {:else}
            <button class="tab tab-add" on:click={showAddInput}>+</button>
        {/if}
    </div>

    <div class="panel-content">
        {#if !notesTabs.length}
            <div class="panel-empty">暂无笔记标签，点击添加按钮开始</div>
        {:else if filterTypes.length}
            <div class="filter-results">
                {#each filteredBlocks as block (block.id)}
                    {@const img = block.custom_screenshot || block.custom_thumbnail}
                    {@const type = { timestamp: i18n?.notes?.types?.timestamp || '时间戳', loop: i18n?.notes?.types?.loop || '循环片段', screenshot: i18n?.notes?.types?.screenshot || '截图', mediacard: i18n?.notes?.types?.mediacard || '媒体卡片' }[block.custom_media] || block.custom_media}
                    {@const time = block.custom_timestamp || block.custom_loop || ''}
                    {@const name = block.custom_media === 'screenshot' ? (block.custom_screenshot?.split('/').pop()?.replace(/\.[^.]+$/, '') || '') : ''}
                    <svelte:element this={block.custom_url ? 'a' : 'div'}
                        href={block.custom_url || null}
                        class="media-card {block.custom_media}"
                        on:click={block.custom_url ? null : () => openBlock(block.id)}>
                        {#if img}<img src="/{img}" alt="" loading="lazy" />{/if}
                        <div class="card-overlay">
                            <div class="media-info">
                                <span>{type}</span>
                                {#if name}<span>{name}</span>{/if}
                                {#if time}<span>{time}</span>{/if}
                            </div>
                        </div>
                    </svelte:element>
                {:else}
                    <div class="panel-empty">暂无筛选内容</div>
                {/each}
            </div>
        {:else}
            {#each notesTabs as tab (tab.id)}
                <div style="display: {activeTab === tab.id ? 'block' : 'none'}; height: 100%;" class="panel-content" use:initProtyle={tab}></div>
            {/each}
        {/if}
    </div>

    {#if notesTabs.length && activeTab}
        <div class="panel-footer" style="left: auto; right: 16px; transform: none;">
            <button class="add-btn" on:click={handleAction}><svg class="icon"><use xlink:href="#iconSparkles"></use></svg></button>
        </div>
    {/if}
</div>
