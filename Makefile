hexo-site-development.zip: index.js package.json
	node-lambda package -A . -n hexo-site -x "build_config.yml context.json db.json debug.log deploy.env event.json event_sources.json hexo-site-development.zip Makefile scaffolds source themes"

clean:
	rm -f hexo-site-development.zip
