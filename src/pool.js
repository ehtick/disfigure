
import { vertexStage } from 'three/tsl';
import { DataTexture, FloatType, InstancedMesh, MeshStandardNodeMaterial, RGBAFormat, TextureNode } from 'three';
import { disfigureBody, EQ } from './tsl.js';
import { loadGLTF, loadJSON } from './assets.js';
import { renderer, camera, scene } from './world.js';



/**
 * A custom version of TextureNode that eliminates TSL code for `flipY` and
 * all UV transformations, including multiplication with UV matrix. I didn't
 * find a better way to do this. Sorry.
 *
 * @augments TextureNode
 */
class DataTextureNode extends TextureNode {

	getTransformedUV( uvNode ) {

		return uvNode;

	}

	setupUV( builder, uvNode ) {

		return uvNode;

	}

} // DataTextureNode



/**
 * A class representing an instanced mesh with TSL material.
 * The data for rigging is stored in a square data texture.
 *
 * @augments InstancedMesh
 */
class Pool extends InstancedMesh {

	constructor( url, MAX_BODIES, lowpoly, useVertexStage ) {

		// create an empty instance mesh

		var material = new MeshStandardNodeMaterial( );

		super( null, material, MAX_BODIES );

		this.count = 0;
		this.castShadow = true;
		this.receiveShadow = true;
		this.frustumCulled = false;

		// create a square data texture that can hold data for at least
		// MAX_BODIES bodies - each body needs EQ number of vec4-s

		this.TEXTURE_SIZE = Math.ceil( Math.sqrt( MAX_BODIES*EQ ) );

		this.dataArray = new Float32Array( 4*this.TEXTURE_SIZE**2 );

		this.quatTexture = new DataTexture(
			this.dataArray,
			this.TEXTURE_SIZE, // width
			this.TEXTURE_SIZE, // height
			RGBAFormat,
			FloatType
		);

		this.quatTexNode = new DataTextureNode( this.quatTexture );

		// asynchronously load the geometry, the skeleton data, hook
		// shaders to material nodes and add the instance to the scene

		Promise.all([
			loadGLTF( url+'.glb', lowpoly ),
			loadJSON( url+'.json' )
		]).then( ([ geometry, data ])=>{

			this.geometry = geometry;
			this.data = data;
console.time('TSL shaders');
			var disfigure = disfigureBody( this, data );
			material.positionNode = disfigure.element( 0 );
			if ( useVertexStage )
				material.normalNode = vertexStage( disfigure.element( 1 ) );
			else
				material.normalNode = disfigure.element( 1 );
			
			this.onLoad();

			scene.add( this );
renderer.compile(scene,camera)
			
console.timeEnd('TSL shaders');


		} );

	} // Pool.constructor



	setQ( figure, joint, vec4 ) {

		vec4.toArray( this.dataArray, ( EQ*figure+joint )*4 );

	} // Pool.setQ



	setXYZ( figure, joint, x, y, z, w=1 ) {

		var base = ( EQ*figure+joint )*4;
		this.dataArray[ base++ ] = x;
		this.dataArray[ base++ ] = y;
		this.dataArray[ base++ ] = z;
		this.dataArray[ base++ ] = w;

	} // Pool.setXYZ



	onLoad() {
	} // Pool.onLoad



	getBody( ) {

		if ( this.count >= this.instanceMatrix.count ) throw ( 'Too many bodies' );

		return this.count++;

	} // Pool.getBody

}


export { Pool };
