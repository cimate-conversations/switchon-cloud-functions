// Front page individuals - list of profiles, sorted by confirmed children - include self
// Front page teams - list of team profiles, sorted by confirmed descendants
// Team page - list of individual profiles, sorted by confirmed children - include self
// Team profile progress bar - count all confirmed descendants

const cache = require('nano-cache');
const Tree = require('./tree');
const request = require('request-promise-native');

const PROFILES_URL = 'http://api.raisely.com/v3/campaigns/switchon/profiles';

/**
 * @query type individual|team
 * @query parent
 * @query sort children|descendants
 * @query limit
 */
async function getProfiles(req, res) {
	try {
		const tree = await getTree();

		const parent = req.query.parent ? tree.get(parent) : tree.root();
		if (!parent) throw new HttpError(404);

		const sortKey = req.query.sort === 'descendants' ? 'confiemdChildren' : 'confirmedDescendants';
		const typeValue = req.query.type === 'team' ? 'TEAM' : 'INDIVIDUAL';
		const limit = parseInt(req.query.limit || 10);

		const result = tree.get(parent.children)
			.map(n => n.data)
			.filter(profile => profile.type === typeValue)
			.sort((p1, p2) => p1[sortKey] - p2[sortKey])
			.slice(0, limit);

		res.json({
			data: result,
			pagination: {
				total: result.length,
				pages: 1,
				prevUrl: null,
				nextUrl: null,
				offset: 0,
				limit,
			}
		});
	} catch (e) {
		res.status(e.status || 500);
		console.error(e);
		res.json({
			error: {
				message: e.message,
			}
		})
	}
}

class HttpError {
	constructor(status, message) {
		this.status = status || 500;
		this.message = message || status === 404 ? 'not found' : 'internal server error';
	}
}

/**
 * Fetch ALL profiles for the campaign
 * (paginates through results to build one array)
 * @return object[]
 */
async function fetchProfiles() {
	const profiles = [];
	let uri = PROFILES_URL;
	do {
		const response = await request({ uri, json: true });
		profiles.push(...response.data);
		uri = response.pagination.nextUrl;
	} while (uri);

	return profiles;
}

/**
 * Build a tree of profiles and calculate the confirmed descendants for each
 * profile
 * @return Tree
 */
async function buildTree() {
	const profiles = await fetchProfiles();

	const tree = new Tree();

	// Walk the tree and calculate the number of confirmed children and descendants
	// of the profiles
	tree.walkUp((node) => {
		const confirmedCounts = node.children.values().reduce((values, nodeId) => {
			const child = tree.get(nodeId);
			const confirmedChild = (child.data.public.switchOnConfirmed) ? 1 : 0;
			values.confirmedChildren += confirmedChild;
			values.confirmedDescendants += child.data.public.confirmedDescendants + confirmedChild;
		}, { confirmedChildren: 0, confirmedDescendants: 0 });

		Object.assign(node.data.public, confirmedCounts);
	});

	cache.set('profileTree', tree, {
		ttl: 15 * 60 * 1000, // 15 minutes
	});
	return tree;
}

/**
 * Get the tree from the cache, or build it
 * @return Tree
 */
async function getTree() {
	return cache.get('profileTree') || await buildTree();
}


module.exports = getProfiles;
