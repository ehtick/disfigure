// disfigure v0.0.25

import { WebGPURenderer, PCFSoftShadowMap, Scene, Color, PerspectiveCamera, DirectionalLight, Object3D, Mesh, CircleGeometry, MeshLambertMaterial, CanvasTexture, InstancedMesh, MeshStandardNodeMaterial, DataTexture, RGBAFormat, FloatType, TextureNode, EventDispatcher, Euler, Quaternion } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { Fn, If, vec4, select, positionGeometry, mat3, normalGeometry, vec3, array, instanceIndex, ivec2, step, Loop, int, transformNormalToView, vertexStage } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';

// number generators

var simplex = new SimplexNoise( );

// generate chaotic but random sequence of numbers in [min.max]
function chaotic( time, offset=0, min=-1, max=1 ) {

	return min + ( max-min )*( simplex.noise( time, offset )+1 )/2;

}



// generate repeated sequence of numbers in [min.max]
function regular( time, offset=0, min=-1, max=1 ) {

	return min + ( max-min )*( Math.sin( time+offset )+1 )/2;

}



// generate random sequence of numbers in [min.max]
function random( min=-1, max=1 ) {

	return min + ( max-min )*Math.random( );

}

var renderer, scene, camera, light, cameraLight, controls, ground, userAnimationLoop, stats, everybody = [];



// creates a default world with primary attributes. the options
// is a collection of flags that turn on/off specific features:
// {
//		lights: true,
//		controls: true,
//		ground: true,
//		antialias: true,
//		shadows: true,
//		stats: false,
// }

class World {

	constructor( options ) {

		renderer = new WebGPURenderer( { antialias: options?.antialias ?? true } );
		renderer.setSize( innerWidth, innerHeight );
		renderer.shadowMap.enabled = options?.shadows ?? true;
		renderer.shadowMap.type = PCFSoftShadowMap;

		document.body.appendChild( renderer.domElement );
		document.body.style.overflow = 'hidden';
		document.body.style.margin = '0';

		scene = new Scene();
		scene.background = new Color( 'whitesmoke' );

		camera = new PerspectiveCamera( 30, innerWidth/innerHeight );
		camera.position.set( 0, 1.5, 4 );

		if ( options?.stats ?? false ) {

			stats = new Stats();
			document.body.appendChild( stats.dom );

		} // stats

		if ( options?.lights ?? true ) {

			light = new DirectionalLight( 'white', 1.4 );
			light.position.set( 0, 14, 7 );
			if ( options?.shadows ?? true ) {

				light.shadow.mapSize.width = 2048;
				light.shadow.mapSize.height = light.shadow.mapSize.width;
				light.shadow.camera.near = 1;
				light.shadow.camera.far = 50;
				light.shadow.camera.left = -5;
				light.shadow.camera.right = 5;
				light.shadow.camera.top = 5;
				light.shadow.camera.bottom = -5;
				light.shadow.normalBias = -0.01;
				light.autoUpdate = false;
				light.castShadow = true;

			} // shadows

			scene.add( light );

			cameraLight = new DirectionalLight( 'white', 1.4 );
			cameraLight.position.z = 100;
			cameraLight.target = new Object3D();
			camera.add( cameraLight );
			scene.add( camera );

		} // lights

		if ( options?.controls ?? true ) {

			controls = new OrbitControls( camera, renderer.domElement );
			controls.enableDamping = true;
			controls.target.set( 0, 0.9, 0 );

		} // controls

		if ( options?.ground ?? true ) {

			// generate ground texture
			var canvas = document.createElement( 'CANVAS' );
			canvas.width = 128;
			canvas.height = 128;

			var context = canvas.getContext( '2d' );
			context.fillStyle = 'white';
			context.filter = 'blur(10px)';
			context.beginPath();
			context.arc( 64, 64, 38, 0, 2*Math.PI );
			context.fill();

			ground = new Mesh(
				new CircleGeometry( 32 ),
				new MeshLambertMaterial( {
					color: 'antiquewhite',
					transparent: true,
					map: new CanvasTexture( canvas )
				} )
			);
			ground.receiveShadow = true;
			ground.rotation.x = -Math.PI / 2;
			ground.renderOrder = -1;
			scene.add( ground );

		} // ground

		window.addEventListener( "resize", ( /*event*/ ) => {

			camera.aspect = innerWidth/innerHeight;
			camera.updateProjectionMatrix( );
			renderer.setSize( innerWidth, innerHeight );

		} );

		renderer.setAnimationLoop( defaultAnimationLoop );

	} // World.constructor

} // World




class AnimateEvent extends Event {

	#target;
	constructor() {

		super( 'animate' );

	}
	get target() {

		return this.#target;

	}
	set target( t ) {

		this.#target = t;

	}

}

var animateEvent = new AnimateEvent( );



// default animation loop that dispatches animation events
// to the window and to each body in the scene

var loader = document.getElementById( 'loader' );

function defaultAnimationLoop( time ) {

	try {

		if ( loader ) {

			loader.style.display = 'none'; loader = undefined;

		}

		animateEvent.time = time;

		window.dispatchEvent( animateEvent );

		everybody.forEach( ( p )=>{

			p.update(); // todo call update only on changed figures
			p.dispatchEvent( animateEvent );

		} );

		if ( userAnimationLoop ) userAnimationLoop( time );

		if ( controls ) {

			controls.update( );
			cameraLight.target.position.copy( controls.target );

		}

		if ( stats ) stats.update( );


		renderer.render( scene, camera );

	} catch ( err ) {

		  renderer.setAnimationLoop( null );
		  throw ( err );

	}

}



// function to set animation loop, for when the user is
// scared to use events

function setAnimationLoop( animationLoop ) {

	userAnimationLoop = animationLoop;

}

const EQ = 54; // number of vec4 per figure, 0..51 are quaternions, 52 is position, 53 is user data
const EQ_POS = 52; // 52 is vec4 for position



var rotateByQuaternion = Fn( ([ p, q ])=>{

	return p.add( q.xyz.cross( q.xyz.cross( p ).add( q.w.mul( p ) ) ).mul( 2 ) );

}, { return: 'vec3', p: 'vec3', q: 'vec4' } );



var disfigureMatrix = Fn( ([ mat, pivot, quat, k ])=>{

	var newMat = mat.toVar();

	// if k>0 the 'matrix' must be updated
	If( k.greaterThan( 0 ), () => {

		var q = quat.toVar();

		// if k<1 the quaternion's rotation must be 'divided'
		If( k.lessThan( 1 ), ()=>{

			var len = quat.xyz.length().toVar();

			If( len.lessThan( 1e-5 ), ()=>{

				q.assign( vec4( 0, 0, 0, 1 ) );

			} ).

				Else( ()=>{

					var acos = k.mul( quat.w.acos() ).toVar();
					q.assign( vec4( quat.xyz.div( len ).mul( acos.sin() ), acos.cos() ) );

				} );

		} ); // k<1

		newMat.element( 0 ).assign( rotateByQuaternion( mat.element( 0 ).sub( pivot ), q ).add( pivot ) );
		newMat.element( 1 ).assign( rotateByQuaternion( mat.element( 1 ), q ) );

	} ); // k>0

	return newMat;

}, { return: 'mat3', mat: 'mat3', pivot: 'vec3', quat: 'vec4', k: 'float' } );



var layout = { pos: 'vec3', range: 'vec4', return: 'float' };



var gradientX = Fn( ([ pos, range ])=>pos.x.add( pos.y.mul( range.z ) ).smoothstep( range.x, range.y ), layout );



var gradientY = Fn( ([ pos, range ])=>pos.y.add( pos.z.mul( range.z ) ).smoothstep( range.x, range.y ), layout );



var gradientYT = Fn( ([ pos, range, slope ])=>{

	return pos.z.add( pos.x.mul( slope ) ).smoothstep( range.z, range.w );

}, { pos: 'vec3', range: 'vec4', slope: 'float', return: 'float' } );



var gradientLeg = Fn( ([ pos, range, range2 ])=>{

	var y = pos.y.sub( pos.x.abs().mul( 1/5 ) );
	var ofs = select( range2.x.equal( 1 ), pos.z.add( 0.05 ).abs().mul( 1/2 ), pos.z.mul( 1/6 ) );

	return pos.x.smoothstep( 0, range2.y )
		.mul( y.smoothstep( range.x.sub( ofs ), range.y ).smoothstep( 0, 1 ).pow( 2 ) )
		.add( pos.x.smoothstep( 0, range2.y.div( 10 ) ).mul( y.smoothstep( range.z, range.w ) ) )
		.clamp( 0, 1 )
	;

}, { return: 'float', pos: 'vec3', range: 'vec4', range2: 'vec2' } );



var gradientArm = Fn( ([ pos, pivot, range ])=>{

	var x = pos.x,
		y = pos.y;

	var dx = y.sub( pivot.y ).div( 4, select( x.greaterThan( 0 ), 1, -1 ) );

	return x.add( dx ).smoothstep( range.x, range.y ).smoothstep( 0, 1 )
		.mul( y.step( range.z ).oneMinus() );

}, { pos: 'vec3', pivot: 'vec3', range: 'vec4', return: 'float' } );



var gradientXT = Fn( ([ pos, range, slope ])=>
	pos.x.add( pos.z.mul( slope ) )
		.smoothstep( range.x, range.y )
		.mul(
			pos.z.smoothstep( range.z.sub( 0.0001 ), range.z.add( 0.0001 ) ),
			pos.z.smoothstep( range.w.add( 0.0001 ), range.w.sub( 0.0001 ) )
		)
, { pos: 'vec3', range: 'vec4', slope: 'float', return: 'float' } );



var disfigureBody = Fn( ([ poolData, figureData ])=>{

	var p = positionGeometry.toVar( ),
		m = mat3( p, normalGeometry.normalize(), vec3( 0 ) ).toVar( );

	var pivots = array( figureData.pivots ).toConst( 'pivots' ),
		ranges = array( figureData.ranges ).toConst( 'ranges' ),
		extras = array( figureData.extras ).toConst( 'extras' );

	var instanceIndexEQ = instanceIndex.mul( EQ ).toVar();

	var getQuatAddr = Fn( ([ instanceIndexEQ, propIndex, texSize ])=>{

		var offset = instanceIndexEQ.add( propIndex ).toVar();
		return ivec2( offset.mod( texSize ), offset.div( texSize ) );

	}, { return: 'ivec2', instanceIndex: 'int', propIndex: 'int', texSize: 'int' } );

	var q = Fn( ([ propIndex ])=> poolData.quatTexNode.load( getQuatAddr( instanceIndexEQ, propIndex, poolData.TEXTURE_SIZE ) ) );


	var isLeft = step( p.x, 0 ).toVar( ),
		isDown = p.y.lessThan( pivots.element( 2 ).y ).toVar( ), //chest
		isHand = p.x.abs().greaterThan( pivots.element( 16 ).x ); // wrist


	var disP = ( i, gradient ) => m.assign( disfigureMatrix( m, pivots.element( i ), q( i ), gradient ) ),
		disY = ( i ) => m.assign( disfigureMatrix( m, pivots.element( i ), q( i ), gradientY( p, ranges.element( i ) ) ) ),
		disX = ( i ) => m.assign( disfigureMatrix( m, pivots.element( i ), q( i ), gradientX( p, ranges.element( i ) ) ) ),
		disT = ( i ) => m.assign( disfigureMatrix( m, pivots.element( i ), q( i ), gradientXT( p, ranges.element( i ), 0 ) ) );

	var pick = ( left, right )=>isLeft.mul( right-left ).add( left ).toVar();
	//	var pick = (left,right)=>select(p.x.greaterThan(0),left,right).toVar();

	If( isDown, ()=>{

		// process legs

		let start = pick( 4, 10 ),
			end = start.add( 5 ).toVar();
		let leg = pick( 0, 1 );

		// foot ankle shin knee thigh
		Loop( { start: start, end: end }, ( { i } ) => disY( i ) );

		// leg
		disP( end, gradientLeg( p, ranges.element( end ), extras.element( leg ).xy ) );

	} ).Else( ()=>{

		// process hands
		If( isHand, ()=>{

			let thumb = pick( 24, 26 );
			let thumb2 = pick( 2, 3 );

			disP( thumb, gradientXT( p, ranges.element( thumb ), extras.element( thumb2 ).x ) );
			thumb.addAssign( 1 );
			disP( thumb, gradientYT( p, ranges.element( thumb ), extras.element( thumb2 ).y ) );

			let start = pick( 28, 40 ),
				end = start.add( 12 );

			// index, middle, ring, pinky
			Loop( { start: start, end: end }, ( { i } ) => disT( i ) );

		} );

		// process arms

		let start = pick( 16, 20 ),
			end = start.add( 3 );

		// wrist forearm elbow
		Loop( { start: start, end: end }, ( { i } ) => disX( i ) );

		// arm
		disP( end, gradientArm( p, pivots.element( end ), ranges.element( end ) ) );

	} );



	//	process torso

	Loop( { end: int( 4 ) }, ( { i } ) => disY( i ) );


	// footer
	//m.element( 0 ).addAssign( q( EQ_POS ) );
	m.element( 1 ).assign( transformNormalToView( m.element( 1 ) ).normalize() );

	return m;//.debug();

} );

// path to GLB models

const ASSETS_PATH = import.meta.url
	.replace( '/src/assets.js', '/assets/models/' )
	.replace( '/dist/disfigure.js', '/assets/models/' )
	.replace( '/dist/disfigure.min.js', '/assets/models/' );



// preloading names of skeleton joints

const JOINTS = ( await fetch( ASSETS_PATH+'body.json' ).then( r => r.json() ) ).joints;




/**
 * Loads a GLB model and optionally simplifies its geometry.
 *
 * The model must have a single mesh with geometry as the first child
 * of `gltf.scene`.
 *
 * @param {string} url - Full URL of the GLB model file.
 * @param {number} [lowpoly=0] - Geometry simplification factor.
 *        Mapped linearly [0 to 1]→[0% to 75%]
 *        - `lowpoly = 0` → keeps the original geometry
 *        - `lowpoly = 1` → removes ~75% of the geometry
 * @returns {Promise<BufferGeometry>} Promise for the geometry.
 */
function loadGLTF( url, lowpoly = 0 ) {

	return new GLTFLoader().loadAsync( ASSETS_PATH+url ).then( gltf => {

		// get the geometry and vertex count to remove

		var geometry = gltf.scene.children[ 0 ].geometry,
			vertices = Math.floor( geometry.attributes.position.count * lowpoly * 0.75 );

		// simplify the geometry if needed

		if ( vertices > 0 ) {

			var simplified = new SimplifyModifier().modify( geometry, vertices );
			geometry.dispose();
			geometry = simplified;

		}

		return geometry;

	} ); // then

} // loadGLTF



/**
 * Loads a JSON model description (skeleton data).
 *
 * Loads pivot points, ranges and extra data. All coordinate arrays
 * are automatically converted to Three.js TSL vectors (`vec3` / `vec4`).
 *
 * @param {string} url - Full URL of the JSON file.
 * @returns {Promise<object>} Promise for an object with:
 *                            - `pivots`: `vec3[]`
 *                            - `ranges`: `vec4[]`
 *                            - `extras`: `vec4[]`
 */
function loadJSON( url ) {

	return fetch( ASSETS_PATH+url ).then( r =>

		r.json().then( data => {

			// convert arrays into array of vectors

			data.pivots = data.pivots.map( x => vec3( ...x ) );
			data.ranges = data.ranges.map( x => vec4( ...x ) );
			data.extras = data.extras.map( x => vec4( ...x ) );

			return data;

		} )

	); // then

} // loadJSON

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

			var disfigure = disfigureBody( this, data );
			material.positionNode = disfigure.element( 0 );
			if ( useVertexStage )
				material.normalNode = vertexStage( disfigure.element( 1 ) );
			else
				material.normalNode = disfigure.element( 1 );

			this.onLoad();

			scene.add( this );

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

// degrees-radian conversion
var toDeg = x => x * 180 / Math.PI,
	toRad = x => x / 180 * Math.PI;



// global unique identifier for bodies
var uid = 0;



class EulerDegrees extends Euler {

	constructor( signX, signY, signZ ) {

		super();
		this.signX = signX;
		this.signY = signY;
		this.signZ = signZ;
		this.quaternion = new Quaternion();
		this.needsUpdate = true;

	}

	set( x, y, z ) {

		this.x = x;
		this.y = y;
		this.z = z;

	}

	set x( n ) {

		super.x = toRad( this.signX*n );
		this.needsUpdate = true;

	}

	set y( n ) {

		super.y = toRad( this.signY*n );
		this.needsUpdate = true;

	}

	set z( n ) {

		super.z = toRad( this.signZ*n );
		this.needsUpdate = true;

	}

	get x( ) {

		return toDeg( this.signX*super.x );

	}

	get y( ) {

		return toDeg( this.signY*super.y );

	}

	get z( ) {

		return toDeg( this.signZ*super.z );

	}

	get q( ) {

		if ( this.needsUpdate ) {

			this.quaternion.setFromEuler( this );
			this.needsUpdate = false;

		}

		return this.quaternion;

	}

}


class Body extends EventDispatcher {

	constructor( pool ) {

		super();

		this.pool = pool;
		this.id = pool.getBody();
		this.uid = uid++;

		this.eulers = [];

		for ( var i=0; i<EQ; i++ ) {

			this.eulers.push( new EulerDegrees( ...JOINTS[ i ].signs ) );

			this[ JOINTS[ i ].name ] = this.eulers[ i ];

		}

		everybody.push( this );

	}

	setPosition( x, y, z ) {

		var array = this.pool.instanceMatrix.array,
			index = this.id * 16+12;

		array[ index++ ] = x;
		array[ index++ ] = y;
		array[ index++ ] = z;

		this.pool.instanceMatrix.needsUpdate = true;

		//this.pool.setXYZ( this.id, EQ_POS, x, y, z );
		//this.pool.quatTexture.needsUpdate = true;

	}

	update( ) {

		for ( var i=0; i<EQ-2; i++ )
			this.pool.setQ( this.id, i, this.eulers[ i ].q );
		this.pool.quatTexture.needsUpdate = true;

	}

} // Body



class Man extends Body {

	static pool = null;
	static count = 10; // max number of men
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( ) {

		if ( Man.pool == null ) {

			Man.pool = new Pool( 'man', Man.count, Man.lowpoly, Man.vertexStage );

		}

		super( Man.pool );

		this.material = Man.pool.material; // expose to outside

		this.l_arm.z = this.r_arm.z = -75;
		this.l_elbow.y = this.r_elbow.y = -20;
		this.l_leg.z = this.r_leg.z = 10;
		this.l_ankle.z = this.r_ankle.z = -10;
		this.l_ankle.x = this.r_ankle.x = 3;

		this.setPosition( 0, -0.012, 0 );

	}

} // Man



class Woman extends Body {

	static pool = null;
	static count = 10; // max number of women
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( ) {

		if ( Woman.pool == null ) {

			Woman.pool = new Pool( 'woman', Woman.count, Woman.lowpoly, Woman.vertexStage );

		}

		super( Woman.pool );

		this.material = Woman.pool.material; // expose to outside

		this.l_arm.z = this.r_arm.z = -90;
		this.l_elbow.y = this.r_elbow.y = 0;
		this.l_leg.z = this.r_leg.z = -3;
		this.l_ankle.z = this.r_ankle.z = 3;
		this.l_ankle.x = this.r_ankle.x = 3;

	}

} // Woman



class Child extends Body {

	static pool = null;
	static count = 10; // max number of children
	static lowpoly = 0; // lowpoly-ness, 0=original, 1.0 remove 75%
	static vertexStage = false; // true for faster but uglier normals

	constructor( ) {

		if ( Child.pool == null ) {

			Child.pool = new Pool( 'child', Child.count, Child.lowpoly, Child.vertexStage );

		}

		super( Child.pool );

		this.material = Child.pool.material; // expose to outside

		this.l_arm.x = this.r_arm.x = -10;
		this.l_arm.z = this.r_arm.z = -80;
		this.l_ankle.bend = this.r_ankle.bend = 3;

	}

} // Child

// disfigure
//
// A software burrito that wraps everything in a single file
// and exports only the things that I think someone might need.



console.log( '\n%c\u22EE\u22EE\u22EE Disfigure\n%chttps://boytchev.github.io/disfigure/\n', 'color: navy', 'font-size:80%' );

export { Child, EQ, EQ_POS, Man, Pool, Woman, World, camera, cameraLight, chaotic, controls, disfigureBody, disfigureMatrix, everybody, gradientArm, gradientLeg, gradientX, gradientXT, gradientY, gradientYT, ground, light, random, regular, renderer, scene, setAnimationLoop };
