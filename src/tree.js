class Tree {
	constructor(opts = {}) {
		this.nodes = {};
		this.id = opts.id || 'uuid';
		this.parentId = opts.parentId || 'parentUuid';
	}

	add(node) {
		const id = node[this.id];
		const parentId = node[this.parentId];
		// eslint-disable-next-line object-curly-newline
		this.nodes[id] = { id, data: node, parentId, children: new Set() };
	}

	/**
	 * Fetch one or more nodes from the tree
	 * @param object|object[] id
	 */
	get(id) {
		if (Array.isArray(id)) {
			return id.map(i => this.nodes[i]);
		}
		return this.nodes[id];
	}

	/**
     * Walk the tree nodes in no particular order
     * @param fn Function to apply to each node
     */
	walk(fn) {
		Object.values(this.nodes).forEach(n => fn(n.node));
	}

	find(fn) {
		return Object.values(this.nodes).find(n => fn(n.node));
	}

	root() {
		if (!this.root) {
			this.root = this.find(n => !n.parentId);
		}
		return this.root;
	}

	path(node) {
		const path = [];
		let n = node;
		while (n.parentId) {
			path.push(n.parentId);
			n = this.nodes[n.parentId];
		}
		return path;
	}

	organise() {
		if (!this.childlessNodes) {
			this.childlessNodes = Object.assign({}, this.nodes);
			Object.keys(this.nodes).forEach((n) => {
				if (n.parentId) {
					this.nodes[n.parentId].children.add(n.id);
					delete this.childlessNodes[n.parentId];
				}
			});
		}

		return Object.values(this.childlessNodes);
	}

	/**
	 * Sort the nodes such that walking them would perform a bottom up traversal
	 * and guarantee that parent nodes are only walked once all children have been
	 * walked
	 * @returns Node[]
	 */
	sort() {
		if (!this.sortedNodes) {
			this.organise();
			const paths = {};
			// Calculate the paths for all nodes with children
			Object.keys(this.nodes).forEach((node) => {
				if (!this.childlessNodes[node.id]) {
					paths[node.id] = this.path(node);
				}
			});

			this.sortedNodes = Object.values(this.nodes)
				.sort((n1, n2) => {
					if (this.childlessNodes[n1.id]) return -1;
					if (this.childlessNodes[n2.id]) return 1;

					if (paths[n1.id].includes(n2.id)) return -1;
					if (paths[n2.id].includes(n1.id)) return 1;

					return 0;
				});
		}
		return this.sortedNodes;
	}

	/**
     * Traverse the tree from the bottom most nodes
     */
	walkUp(fn) {
		const sorted = this.sort();
		sorted.forEach(fn);
	}
}

module.exports = Tree;
